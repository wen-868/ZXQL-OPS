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
  WorkflowRunStatus,
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
    WorkflowService.validateDag(nodes, edges);
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

    WorkflowService.applyUpdate(def, dto);
    if (dto.trigger === 'cron' && !def.cronExpr) {
      throw new AppError('WORKFLOW_CRON_REQUIRED');
    }
    return this.defRepo.save(def);
  }

  /** 标量字段回写：仅当 dto 显式提供（!== undefined）时覆盖，null 语义保留 */
  private static applyUpdate(def: WorkflowDefEntity, dto: UpdateWorkflowDto): void {
    if (dto.enabled !== undefined) def.enabled = dto.enabled;
    if (dto.nodes || dto.edges) WorkflowService.applyGraph(def, dto);
    if (dto.trigger !== undefined) def.trigger = dto.trigger as WorkflowTrigger;
    if (dto.cronExpr !== undefined) def.cronExpr = dto.cronExpr ?? null;
  }

  /** 节点/边更新：未显式提供的一侧沿用原定义；改图必经 DAG 校验 */
  private static applyGraph(
    def: WorkflowDefEntity,
    dto: { nodes?: UpdateWorkflowDto['nodes']; edges?: UpdateWorkflowDto['edges'] },
  ): void {
    const nodes = (dto.nodes ?? def.nodes) as unknown as WorkflowNode[];
    const edges = dto.edges ?? def.edges;
    WorkflowService.validateDag(nodes, edges);
    def.nodes = nodes;
    def.edges = edges;
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

    const { doneCount, failedCount } = await this.runAllNodes(def, savedRun, tenantId, traceId);

    savedRun.status = WorkflowService.resolveStatus(doneCount, failedCount);
    savedRun.finishedAt = new Date();
    savedRun.progress = 100;
    await this.runRepo.save(savedRun);
    return { runId: savedRun.id, traceId };
  }

  /** 按拓扑序逐节点执行并回写进度；返回成功/失败节点计数 */
  private async runAllNodes(
    def: WorkflowDefEntity,
    savedRun: WorkflowRunEntity,
    tenantId: string,
    traceId: string,
  ): Promise<{ doneCount: number; failedCount: number }> {
    const nodes = def.nodes;
    const order = topoSort(nodes, def.edges ?? []) ?? nodes.map((n) => n.id);
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
      const { ok } = await this.runOneNode(savedRun, node, ctx, tenantId, traceId);
      if (ok) doneCount++;
      else failedCount++;
      savedRun.progress = Math.floor(((i + 1) / order.length) * 100);
      await this.runRepo.save(savedRun);
    }
    return { doneCount, failedCount };
  }

  /** 终态判定：全成=success；全败=failed；部分失败=partial */
  private static resolveStatus(doneCount: number, failedCount: number): WorkflowRunStatus {
    if (failedCount === 0) return 'success';
    return doneCount === 0 ? 'failed' : 'partial';
  }

  /** 单节点执行：建日志 → 执行 → 落库；失败隔离（整 run 记 partial 而非全败） */
  private async runOneNode(
    savedRun: WorkflowRunEntity,
    node: WorkflowNode,
    ctx: Record<string, unknown>,
    tenantId: string,
    traceId: string,
  ): Promise<{ ok: boolean }> {
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
      this.applyNodeOutput(ctx, node, out);
      log.status = 'done';
      log.output = out ?? null;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      log.status = 'failed';
      log.output = { error: message };
    }
    await this.logRepo.save(log);
    return { ok: log.status === 'done' };
  }

  /** SSE 实时进度（阶段1：轮询 run + logs，终态则结束流） */
  streamRun(id: number): Observable<{ data: any }> {
    return interval(500).pipe(take(30), switchMapToRun(this.runRepo, this.logRepo, id));
  }

  // ---- 私有 ----

  private static validateDag(nodes: WorkflowNode[], edges: WorkflowEdge[]): void {
    WorkflowService.assertNoDupNode(nodes);
    WorkflowService.assertEdgesValid(nodes, edges);
    if (detectCycle(nodes, edges)) {
      throw new AppError('WORKFLOW_DAG_CYCLE');
    }
  }

  private static assertNoDupNode(nodes: WorkflowNode[]): void {
    const ids = nodes.map((n) => n.id);
    if (new Set(ids).size !== ids.length) {
      throw new AppError('WORKFLOW_NODE_DUP');
    }
  }

  private static assertEdgesValid(nodes: WorkflowNode[], edges: WorkflowEdge[]): void {
    const idSet = new Set(nodes.map((n) => n.id));
    for (const e of edges) {
      if (!idSet.has(e.from) || !idSet.has(e.to)) {
        throw new AppError('WORKFLOW_EDGE_INVALID');
      }
    }
  }

  /** 上游节点输出落到 ctx 快捷槽位（后续节点缺参时回退引用）；映射表驱动 */
  private static readonly OUTPUT_SLOTS: Record<string, [outKey: string, ctxKey: string]> = {
    ideate: ['topicId', '__topicId'],
    script: ['scriptId', '__scriptId'],
    material: ['materialIds', '__materialIds'],
    video: ['videoId', '__videoId'],
  };

  private applyNodeOutput(
    ctx: Record<string, unknown>,
    node: WorkflowNode,
    out: Record<string, unknown> | undefined,
  ): void {
    const slot = WorkflowService.OUTPUT_SLOTS[node.type];
    if (!slot || !out) return;
    const [outKey, ctxKey] = slot;
    if (out[outKey]) ctx[ctxKey] = out[outKey];
  }

  /** 节点执行器注册表：node.type → 执行函数（取代巨型 switch，圈复杂度由 26 降至 ~3） */
  private readonly nodeExecutor: Record<
    string,
    (
      config: Record<string, unknown>,
      ctx: Record<string, unknown>,
    ) => Promise<Record<string, unknown>>
  > = {
    collect: () => this.executeCollect(),
    analyze: () => this.executeAnalyze(),
    ideate: (config) => this.executeIdeate(config),
    script: (config, ctx) => this.executeScript(config, ctx),
    material: (config, ctx) => this.executeMaterial(config, ctx),
    video: (config, ctx) => this.executeVideo(config, ctx),
    publish: (config, ctx) => this.executePublish(config, ctx),
    recycle: () => Promise.resolve({ skipped: true, reason: 'J 回收未纳入阶段1' }),
  };

  private async executeNode(
    node: WorkflowNode,
    ctx: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const config = node.config ?? {};
    const executor = this.nodeExecutor[node.type];
    if (!executor) throw new AppError('WORKFLOW_NODE_UNKNOWN');
    return executor(config, ctx);
  }

  private async executeCollect(): Promise<Record<string, unknown>> {
    await this.intelService.processPendingTasks();
    return { triggered: true };
  }

  private async executeAnalyze(): Promise<Record<string, unknown>> {
    const clustered = await this.analyzeService.processPendingAnalysis();
    return { clustered };
  }

  private async executeIdeate(config: Record<string, unknown>): Promise<Record<string, unknown>> {
    const { topics } = await this.topicService.generateTopics({
      driver: config.driver as string | undefined,
      emotion: config.emotion as string | undefined,
    });
    return { topicId: topics[0]?.id ?? null, count: topics.length };
  }

  private async executeScript(
    config: Record<string, unknown>,
    ctx: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const topicId = (config.topicId as number | undefined) ?? (ctx.__topicId as number | undefined);
    if (!topicId) throw new AppError('WORKFLOW_MISSING_INPUT');
    const { script } = await this.scriptService.generateScript({ topicId });
    return { scriptId: script.id };
  }

  private async executeMaterial(
    config: Record<string, unknown>,
    ctx: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
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

  private async executeVideo(
    config: Record<string, unknown>,
    ctx: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
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

  private async executePublish(
    config: Record<string, unknown>,
    ctx: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const scriptId =
      (config.scriptId as number | undefined) ?? (ctx.__scriptId as number | undefined);
    if (!scriptId) throw new AppError('WORKFLOW_MISSING_INPUT');
    const accountIds: number[] = (config.accountIds as number[] | undefined) ?? [];
    const videoId = (config.videoId as number | undefined) ?? (ctx.__videoId as number | undefined);
    const { taskIds } = await this.publishService.publish({
      scriptId,
      accountIds,
      platform: config.platform as string | undefined,
      videoId,
    });
    return { taskIds, videoId };
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
