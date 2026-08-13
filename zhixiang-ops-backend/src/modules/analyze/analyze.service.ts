import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { AppError } from '../../shared/app-error';
import { buildPage, pageOffset, PaginatedResult } from '../../shared/pagination';
import { TenantContext } from '../../tenant/tenant-context';
import { SkillGateway } from '../../skill/skill.gateway';
import { CollectedCommentEntity } from '../intel/collected-comment.entity';
import { CollectSourceType } from '../intel/intel.types';
import { AnalysisTaskEntity } from './analysis-task.entity';
import { HumanInsightEntity } from './human-insight.entity';
import {
  AnalysisClusterResult,
  AnalysisSource,
  AnalysisStatus,
  AnalyzeInsight,
  EmotionType,
  EMOTION_TYPES,
  HUMANITY_DRIVERS,
  HumanityDriver,
} from './analyze.types';
import { CreateAnalysisTaskDto } from './dto/create-analysis-task.dto';
import { CreateInsightDto } from './dto/create-insight.dto';
import { InsightQueryDto } from './dto/insight-query.dto';

/** 聚类 prompt 版本（便于回溯） */
const PROMPT_VERSION = 'v1';
/** 单次分析最大参与评论条数 */
const MAX_COMMENTS = 200;

/**
 * 人性分析与洞察引擎服务（规划 §4-D）。
 * 职责：消费 C 清洗后的干净评论 → 经能力网关做 7×6 归因聚类（仅输出聚合统计，
 * 不留存个人信息，合规边界②）→ 洞察知识库沉淀/去重/引用计数 → 报告聚合。
 * 全部按 tenantId 隔离（TenantContext.requireTenantId + 显式 where）。
 */
@Injectable()
export class AnalyzeService {
  private readonly logger = new Logger(AnalyzeService.name);

  constructor(
    @InjectRepository(AnalysisTaskEntity)
    private readonly taskRepo: Repository<AnalysisTaskEntity>,
    @InjectRepository(HumanInsightEntity)
    private readonly insightRepo: Repository<HumanInsightEntity>,
    @InjectRepository(CollectedCommentEntity)
    private readonly commentRepo: Repository<CollectedCommentEntity>,
    private readonly skill: SkillGateway,
  ) {}

  // —— 分析任务 ——

  /**
   * 发起人性分析任务：取干净评论（is_clean=true）→ 校验非空 → 落 pending。
   * 由 @Cron processPendingAnalysis 异步聚类处理。返回 { taskId, traceId }。
   */
  async createAnalysisTask(
    dto: CreateAnalysisTaskDto,
  ): Promise<{ taskId: number; traceId: string }> {
    const tenantId = TenantContext.requireTenantId();
    const comments = await this.loadComments(tenantId, {
      platform: dto.platform,
      inputRefs: dto.inputRefs,
      commentLimit: dto.commentLimit ?? MAX_COMMENTS,
    });
    if (comments.length === 0) throw new AppError('ANALYSIS_EMPTY_INPUT');

    const task = this.taskRepo.create({
      tenantId,
      source: dto.source ?? AnalysisSource.Comments,
      platform: dto.platform,
      inputRefs: dto.inputRefs,
      status: AnalysisStatus.Pending,
      progress: 0,
      totalComments: 0,
      promptVersion: PROMPT_VERSION,
    });
    const saved = await this.taskRepo.save(task);
    return { taskId: saved.id, traceId: TenantContext.getTraceId() ?? '' };
  }

  async getAnalysisTask(id: number): Promise<AnalysisTaskEntity> {
    const tenantId = TenantContext.requireTenantId();
    const task = await this.taskRepo.findOne({ where: { id, tenantId } });
    if (!task) throw new AppError('ANALYSIS_TASK_NOT_FOUND');
    return task;
  }

  /**
   * 异步工作器（每 5 秒）：处理 pending 任务 → running → done/failed。
   * 取干净评论 → 组装聚类 prompt → 调能力网关 → 解析聚合 → 沉淀洞察 → 回填。
   */
  @Cron(CronExpression.EVERY_5_SECONDS)
  async processPendingAnalysis(): Promise<void> {
    const pending = await this.taskRepo.find({
      where: { status: AnalysisStatus.Pending },
      take: 5,
    });
    for (const task of pending) {
      task.status = AnalysisStatus.Running;
      task.progress = 10;
      await this.taskRepo.save(task);
      try {
        const comments = await this.loadComments(task.tenantId, {
          platform: task.platform,
          inputRefs: task.inputRefs,
          commentLimit: MAX_COMMENTS,
        });
        task.totalComments = comments.length;
        const prompt = this.buildClusterPrompt(comments.map((c) => c.content));
        const result = await this.skill.invoke({
          skill: 'text-generate',
          prompt,
          tenantId: task.tenantId,
        });
        const cluster = this.parseCluster(result.content);

        task.driverCounts = cluster.driverCounts;
        task.emotionScores = cluster.emotionScores;
        task.topDrivers = cluster.topDrivers;
        task.topEmotions = cluster.topEmotions;
        task.insights = cluster.insights;
        task.modelUsed = result.modelUsed;
        task.promptVersion = PROMPT_VERSION;
        task.progress = 100;
        task.status = AnalysisStatus.Done;
        task.finishedAt = new Date();
        await this.taskRepo.save(task);

        // 聚类洞察沉淀进知识库（去重 + 引用计数）
        await this.seedInsights(task.tenantId, cluster.insights, task.id);
      } catch (err) {
        task.status = AnalysisStatus.Failed;
        task.errorMsg = (err as Error).message;
        task.finishedAt = new Date();
        await this.taskRepo.save(task).catch(() => undefined);
      }
    }
  }

  // —— 洞察知识库 ——

  async listInsights(query: InsightQueryDto): Promise<PaginatedResult<HumanInsightEntity>> {
    const tenantId = TenantContext.requireTenantId();
    const { skip, take } = pageOffset(query.page, query.pageSize);
    const qb = this.insightRepo
      .createQueryBuilder('i')
      .where('i.tenant_id = :tenantId', { tenantId });
    if (query.driver) qb.andWhere('i.driver = :driver', { driver: query.driver });
    if (query.emotion) qb.andWhere('i.emotion = :emotion', { emotion: query.emotion });
    if (query.category) qb.andWhere('i.category = :category', { category: query.category });
    qb.orderBy('i.usageCount', 'DESC').addOrderBy('i.created_at', 'DESC').skip(skip).take(take);

    const [rows, total] = await qb.getManyAndCount();
    return buildPage(rows, total, query.page ?? 1, query.pageSize ?? 20);
  }

  /** 人工沉淀洞察：校验 7 人性 / 6 情绪 → 去重（同租户+title+driver 累加 usage_count） */
  async createInsight(dto: CreateInsightDto): Promise<HumanInsightEntity> {
    const tenantId = TenantContext.requireTenantId();
    if (!HUMANITY_DRIVERS.includes(dto.driver as HumanityDriver)) {
      throw new AppError('HUMANITY_INVALID');
    }
    if (!EMOTION_TYPES.includes(dto.emotion as EmotionType)) {
      throw new AppError('EMOTION_INVALID');
    }

    const existing = await this.insightRepo.findOne({
      where: { tenantId, title: dto.title, driver: dto.driver },
    });
    if (existing) {
      existing.usageCount += 1;
      existing.content = dto.content;
      existing.category = dto.category;
      existing.emotion = dto.emotion;
      existing.tags = dto.tags;
      return this.insightRepo.save(existing);
    }

    const entity = this.insightRepo.create({
      tenantId,
      category: dto.category,
      driver: dto.driver,
      emotion: dto.emotion,
      title: dto.title,
      content: dto.content,
      tags: dto.tags,
      usageCount: 1,
    });
    return this.insightRepo.save(entity);
  }

  // —— 报告 ——

  async getReport(): Promise<{
    topDrivers: string[];
    topEmotions: string[];
    driverCounts: Record<string, number>;
    emotionScores: Record<string, number>;
    insights: AnalyzeInsight[];
    recentTaskId?: number;
  }> {
    const tenantId = TenantContext.requireTenantId();
    const task = await this.taskRepo.findOne({
      where: { tenantId, status: AnalysisStatus.Done },
      order: { finishedAt: 'DESC' },
    });
    if (!task) {
      return { topDrivers: [], topEmotions: [], driverCounts: {}, emotionScores: {}, insights: [] };
    }
    return {
      topDrivers: task.topDrivers ?? [],
      topEmotions: task.topEmotions ?? [],
      driverCounts: task.driverCounts ?? {},
      emotionScores: task.emotionScores ?? {},
      insights: task.insights ?? [],
      recentTaskId: task.id,
    };
  }

  // —— 内部 ——

  private async loadComments(
    tenantId: string,
    opts: { platform?: string; inputRefs?: string[]; commentLimit?: number },
  ): Promise<CollectedCommentEntity[]> {
    const qb = this.commentRepo
      .createQueryBuilder('c')
      .where('c.tenant_id = :tenantId', { tenantId })
      .andWhere('c.is_clean = :isClean', { isClean: true });
    if (opts.platform) {
      qb.andWhere('c.platform = :platform', { platform: opts.platform });
    }
    if (opts.inputRefs && opts.inputRefs.length) {
      qb.andWhere('c.source_ref IN (:...refs)', { refs: opts.inputRefs });
    }
    qb.orderBy('c.collected_at', 'DESC').take(opts.commentLimit ?? MAX_COMMENTS);
    return qb.getMany();
  }

  /** 沉淀聚类洞察进知识库（去重 + 引用计数） */
  private async seedInsights(
    tenantId: string,
    insights: AnalyzeInsight[],
    refAnalysisId: number,
  ): Promise<void> {
    for (const ins of insights) {
      const existing = await this.insightRepo.findOne({
        where: { tenantId, title: ins.title, driver: ins.driver },
      });
      if (existing) {
        existing.usageCount += 1;
        existing.content = ins.content;
        await this.insightRepo.save(existing);
      } else {
        const entity = this.insightRepo.create({
          tenantId,
          category: ins.category,
          driver: ins.driver,
          emotion: ins.emotion,
          title: ins.title,
          content: ins.content,
          tags: ins.tags,
          refAnalysisId,
          usageCount: 1,
        });
        await this.insightRepo.save(entity);
      }
    }
  }

  /** 构造 7×6 归因聚类 prompt（§14 JSON Schema 对齐），要求严格 JSON 输出 */
  private buildClusterPrompt(comments: string[]): string {
    const text = comments.map((c, i) => `${i + 1}. ${c}`).join('\n');
    return [
      '你是一个短视频评论人性分析引擎。给定一批已清洗的评论文本，请按 7 种人性',
      '（贪/懒/怕/虚荣/窥探/孤独爱/愤怒不公）和 6 种情绪（愤怒/共鸣/好奇/感动/焦虑/爽感）做归因聚类。',
      '每条评论可命中多个人性和多个情绪，请分别累加计数。',
      '仅输出严格 JSON（不要使用 markdown 代码块包裹），结构如下：',
      '{',
      '  "driverCounts": {"贪": n, ...},',
      '  "emotionScores": {"愤怒": n, ...},',
      '  "topDrivers": ["贪","懒"],',
      '  "topEmotions": ["好奇","感动"],',
      '  "insights": [{"category":"贪","driver":"贪","emotion":"好奇","title":"...","content":"...","tags":["..."]}]',
      '}',
      '',
      '评论文本：',
      text,
    ].join('\n');
  }

  /** 解析能力网关返回的聚类 JSON（兼容 ```json 围栏包裹） */
  private parseCluster(raw: string): AnalysisClusterResult {
    let s = raw.trim();
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) s = fence[1].trim();
    const obj = JSON.parse(s) as Partial<AnalysisClusterResult>;
    if (typeof obj !== 'object' || obj === null) {
      throw new Error('聚类结果格式非法');
    }
    return {
      driverCounts: obj.driverCounts ?? {},
      emotionScores: obj.emotionScores ?? {},
      topDrivers: Array.isArray(obj.topDrivers) ? obj.topDrivers : [],
      topEmotions: Array.isArray(obj.topEmotions) ? obj.topEmotions : [],
      insights: Array.isArray(obj.insights) ? obj.insights : [],
    };
  }

  /**
   * J 回收回流：将回收到的评论以 is_clean 形态注入 collected_comments，并创建一条
   * 异步分析任务。异步聚合并聚类 worker（clusterComments）会消费这些评论产出再分析结果，
   * 其 taskId 由 J 回写到 feedback.re_analysis_id 形成闭环。
   */
  async reanalyzeFromRecycle(
    comments: string[],
    attributionId: string,
  ): Promise<{ taskId: number; traceId: string }> {
    const tenantId = TenantContext.requireTenantId();
    if (!comments.length) throw new AppError('ANALYSIS_EMPTY_INPUT');
    for (const c of comments) {
      const contentHash = createHash('sha256')
        .update(`${tenantId}:${attributionId}:${c}`)
        .digest('hex');
      const exists = await this.commentRepo.findOne({ where: { tenantId, contentHash } });
      if (exists) continue;
      await this.commentRepo.save(
        this.commentRepo.create({
          tenantId,
          platform: 'recycle',
          sourceType: CollectSourceType.Comment,
          sourceRef: attributionId,
          content: c,
          isClean: true,
          cleanResult: { piiRemoved: [], ad: false } as unknown as Record<string, unknown>,
          contentHash,
          collectedAt: new Date(),
        }),
      );
    }
    const task = this.taskRepo.create({
      tenantId,
      source: AnalysisSource.Comments,
      platform: 'recycle',
      inputRefs: [attributionId],
      status: AnalysisStatus.Pending,
      progress: 0,
      totalComments: 0,
      promptVersion: PROMPT_VERSION,
    });
    const saved = await this.taskRepo.save(task);
    return { taskId: saved.id, traceId: TenantContext.getTraceId() ?? '' };
  }
}
