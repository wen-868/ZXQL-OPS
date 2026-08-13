import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { interval, Observable } from 'rxjs';
import { switchMap, take } from 'rxjs/operators';
import { AppError } from '../../shared/app-error';
import { TenantContext } from '../../tenant/tenant-context';
import { buildPage, pageOffset, PaginationQueryDto } from '../../shared/pagination';
import { IntelService } from '../intel/intel.service';
import { AnalyzeService } from '../analyze/analyze.service';
import { TopicService } from '../topic/topic.service';
import { ScriptService } from '../script/script.service';
import { MaterialService } from '../g/g.service';
import { VideoService } from '../h/h.service';
import { PublishService } from '../publish/publish.service';
import { WorkflowDefEntity } from './workflow.entity';
import { WorkflowRunEntity } from './workflow.entity';
import { WorkflowRunLogEntity } from './workflow.entity';
import {
  detectCycle,
  topoSort,
  WorkflowEdge,
  WorkflowNode,
  WorkflowTrigger,
} from './workflow.types';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';

/**
 * 工作流编排服务（规划 §4-L）。
 * 串联 C→D→E→F→I 为 pipeline：每个节点 = 对上游模块的调用封装；
 * 异步顺序执行 + 单节点失败隔离（标记 partial 而非全败）；DAG 保存时校验。
 */
@Injectable()
export class WorkflowService {
  constructor(
    @InjectRepository(WorkflowDefEntity)
    private readonly defRepo: Repository<WorkflowDefEntity>,
    @InjectRepository(WorkflowRunEntity)
    private readonly runRepo: Repository<WorkflowRunEntity>,
    @InjectRepository(WorkflowRunLogEntity)
    private readonly logRepo: Repository<WorkflowRunLogEntity>,
    private readonly intelService: IntelService,
    private readonly analyzeService: AnalyzeService,
    private readonly topicService: TopicService,
    private readonly scriptService: ScriptService,
    private readonly materialService: MaterialService,
    private readonly videoService: VideoService,
    private readonly publishService: PublishService,
  ) {}

  async createDef(dto: CreateWorkflowDto): Promise<WorkflowDefEntity> {
    const tenantId = TenantContext.requireTenantId();
    const nodes = dto.nodes as unknown as WorkflowNode[];
    const edges = (dto.edges ?? []) as unknown as WorkflowEdge[];
    this.validateDag(nodes, edges);
    if (dto.trigger === 'cron' && !dto.cronExpr) {
      throw new AppError('WORKFLOW_CRON_REQUIRED');
    }
    const def = this.defRepo.create({
      tenantId,
      name: dto.name,
      nodes,
      edges,
      trigger: dto.trigger as WorkflowTrigger,
      cronExpr: dto.cronExpr ?? null,
      enabled: dto.enabled ?? true,
    });
    return this.defRepo.save(def);
  }

  async listDefs(query: PaginationQueryDto): Promise<{
    list: WorkflowDefEntity[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const tenantId = TenantContext.requireTenantId();
    const { skip, take } = pageOffset(query.page, query.pageSize);
    const [list, total] = await this.defRepo
      .createQueryBuilder('w')
      .where('w.tenant_id = :tenantId', { tenantId })
      .orderBy('w.created_at', 'DESC')
      .skip(skip)
      .take(take)
      .getManyAndCount();
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, query.pageSize ?? 20));
    return buildPage(list, total, page, pageSize);
  }

  async getDef(id: number): Promise<WorkflowDefEntity> {
    const tenantId = TenantContext.requireTenantId();
    const def = await this.defRepo.findOne({ where: { id, tenantId } });
    if (!def) throw new AppError('WORKFLOW_NOT_FOUND');
    return def;
  }

  async updateDef(id: number, dto: UpdateWorkflowDto): Promise<WorkflowDefEntity> {
    const tenantId = TenantContext.requireTenantId();
    const def = await this.defRepo.findOne({ where: { id, tenantId } });
    if (!def) throw new AppError('WORKFLOW_NOT_FOUND');

    if (dto.enabled !== undefined) def.enabled = dto.enabled;
    if (dto.nodes || dto.edges) {
      const nodes = (dto.nodes ?? def.nodes) as unknown as WorkflowNode[];
      const edges = dto.edges ?? def.edges;
      this.validateDag(nodes, edges);
      def.nodes = nodes;
      def.edges = edges;
    }
    if (dto.trigger !== undefined) def.trigger = dto.trigger as WorkflowTrigger;
    if (dto.cronExpr !== undefined) def.cronExpr = dto.cronExpr ?? null;
    if (dto.trigger === 'cron' && !def.cronExpr) {
      throw new AppError('WORKFLOW_CRON_REQUIRED');
    }
    return this.defRepo.save(def);
  }

  /** 手动/事件触发运行（串联 C→D→E→F→G→H→I 全链路） */
  async run(defId: number): Promise<{ runId: number; traceId: string }> {
    const tenantId = TenantContext.requireTenantId();
    const traceId = TenantContext.getTraceId() ?? '';
    const def = await this.defRepo.findOne({ where: { id: defId, tenantId } });
    if (!def) throw new AppError('WORKFLOW_NOT_FOUND');

    const run = this.runRepo.create({
      tenantId,
      defId: def.id,
      status: 'running',
      progress: 0,
      startedAt: new Date(),
    });
    const savedRun = await this.runRepo.save(run);

    const nodes = def.nodes;
    const edges = def.edges ?? [];
    const order = topoSort(nodes, edges) ?? nodes.map((n) => n.id);
    const ctx: Record<string, any> = {
      __topicId: undefined,
      __scriptId: undefined,
      __materialIds: undefined,
      __videoId: undefined,
    };
    let doneCount = 0;
    let failedCount = 0;

    for (let i = 0; i < order.length; i++) {
      const node = nodes.find((n) => n.id === order[i])!;
      const log = this.logRepo.create({
        tenantId,
        runId: savedRun.id,
        nodeId: node.id,
        nodeType: node.type,
        status: 'running',
        input: node.config ?? null,
        traceId,
      });
      await this.logRepo.save(log);

      try {
        const out = await this.executeNode(node, ctx);
        ctx[node.id] = out;
        if (node.type === 'ideate' && out?.topicId) ctx.__topicId = out.topicId;
        if (node.type === 'script' && out?.scriptId) ctx.__scriptId = out.scriptId;
        if (node.type === 'material' && out?.materialIds) ctx.__materialIds = out.materialIds;
        if (node.type === 'video' && out?.videoId) ctx.__videoId = out.videoId;
        log.status = 'done';
        log.output = out ?? null;
        doneCount++;
      } catch (e) {
        // 单节点失败隔离：标记失败并继续，整 run 记 partial 而非全败
        const message = e instanceof Error ? e.message : String(e);
        log.status = 'failed';
        log.output = { error: message };
        failedCount++;
      }
      await this.logRepo.save(log);
      savedRun.progress = Math.floor(((i + 1) / order.length) * 100);
      await this.runRepo.save(savedRun);
    }

    savedRun.status = failedCount === 0 ? 'success' : doneCount === 0 ? 'failed' : 'partial';
    savedRun.finishedAt = new Date();
    savedRun.progress = 100;
    await this.runRepo.save(savedRun);
    return { runId: savedRun.id, traceId };
  }

  /** SSE 实时进度（阶段1：轮询 run + logs，终态则结束流） */
  streamRun(id: number): Observable<{ data: any }> {
    return interval(500).pipe(take(30), switchMapToRun(this.runRepo, this.logRepo, id));
  }

  // ---- 私有 ----

  private validateDag(nodes: WorkflowNode[], edges: WorkflowEdge[]): void {
    const ids = nodes.map((n) => n.id);
    if (new Set(ids).size !== ids.length) {
      throw new AppError('WORKFLOW_NODE_DUP');
    }
    const idSet = new Set(ids);
    for (const e of edges) {
      if (!idSet.has(e.from) || !idSet.has(e.to)) {
        throw new AppError('WORKFLOW_EDGE_INVALID');
      }
    }
    if (detectCycle(nodes, edges)) {
      throw new AppError('WORKFLOW_DAG_CYCLE');
    }
  }

  private async executeNode(
    node: WorkflowNode,
    ctx: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const config = node.config ?? {};
    switch (node.type) {
      case 'collect':
        await this.intelService.processPendingTasks();
        return { triggered: true };
      case 'analyze': {
        // 聚类待处理评论（C 已采集清洗的）
        const clustered = await this.analyzeService.processPendingAnalysis();
        return { clustered };
      }
      case 'ideate': {
        const { topics } = await this.topicService.generateTopics({
          driver: config.driver as string | undefined,
          emotion: config.emotion as string | undefined,
        });
        return { topicId: topics[0]?.id ?? null, count: topics.length };
      }
      case 'script': {
        const topicId =
          (config.topicId as number | undefined) ?? (ctx.__topicId as number | undefined);
        if (!topicId) throw new AppError('WORKFLOW_MISSING_INPUT');
        const { script } = await this.scriptService.generateScript({ topicId });
        return { scriptId: script.id };
      }
      case 'material': {
        const scriptId =
          (config.scriptId as number | undefined) ?? (ctx.__scriptId as number | undefined);
        if (!scriptId) throw new AppError('WORKFLOW_MISSING_INPUT');
        const prompt = (config.prompt as string) ?? 'AI短视频素材';
        const materialType = (config.materialType as string) ?? 'video';
        const material = await this.materialService.generateMaterial({
          type: materialType,
          prompt,
          ratio: config.ratio as string | undefined,
          relatedScriptId: scriptId,
        });
        return { materialIds: [material.id], type: materialType };
      }
      case 'video': {
        const scriptId =
          (config.scriptId as number | undefined) ?? (ctx.__scriptId as number | undefined);
        if (!scriptId) throw new AppError('WORKFLOW_MISSING_INPUT');
        const materialIds =
          (config.materialIds as number[] | undefined) ??
          (ctx.__materialIds as number[] | undefined) ??
          [];
        const video = await this.videoService.fromScript({
          scriptId,
          materialIds,
          ratio: config.ratio as string | undefined,
        });
        return { videoId: video.id, status: video.status };
      }
      case 'publish': {
        const scriptId =
          (config.scriptId as number | undefined) ?? (ctx.__scriptId as number | undefined);
        if (!scriptId) throw new AppError('WORKFLOW_MISSING_INPUT');
        const accountIds: number[] = (config.accountIds as number[] | undefined) ?? [];
        const videoId =
          (config.videoId as number | undefined) ?? (ctx.__videoId as number | undefined);
        const { taskIds } = await this.publishService.publish({
          scriptId,
          accountIds,
          platform: config.platform as string | undefined,
          videoId,
        });
        return { taskIds, videoId };
      }
      case 'recycle':
        // J 回收未纳入阶段1，占位跳过
        return { skipped: true, reason: 'J 回收未纳入阶段1' };
      default:
        throw new AppError('WORKFLOW_NODE_UNKNOWN');
    }
  }
}

// 小工具：将 interval 映射为 run 快照
function switchMapToRun(
  runRepo: Repository<WorkflowRunEntity>,
  logRepo: Repository<WorkflowRunLogEntity>,
  id: number,
) {
  return switchMap(async () => {
    const run = await runRepo.findOne({ where: { id } });
    const logs = await logRepo.find({ where: { runId: id } });
    return { data: { run, logs } };
  });
}
