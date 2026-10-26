import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';
import { AppError } from '../../shared/app-error';
import { TenantContext } from '../../tenant/tenant-context';
import { PublishTaskEntity } from '../publish/publish.entity';
import { ScriptEntity } from '../script/script.entity';
import { TopicEntity } from '../topic/topic.entity';
import { AnalyzeService } from '../analyze/analyze.service';
import { TopicService } from '../topic/topic.service';
import { FeedbackEntity } from './recycle.entity';
import { RecycleTaskEntity, DriverEfficiencyEntity } from './recycle.entity';
import { CreateRecycleDto } from './dto/create-recycle.dto';
import { RecycleMetrics, RecycleScope, RecycleStatus } from './recycle.types';

/** 模拟指标确定性种子（同一 extPostId 多次回收结果稳定） */
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * 数据监控与回收服务（规划 §4-J / 开发顺序第8步）。
 * 职责：回收 I 发布数据 → 模拟五维四率反馈（仅聚合，无单条个人信息，合规边界②）
 * → 计算人性效能（driver_efficiency）反哺 E 选题权重 → 回流 D 再分析（re_analysis_id 闭环）。
 * attribution_id 透传 I（F→I→J 只读，禁止重生成）。全部按 tenantId 隔离。
 */
@Injectable()
export class RecycleService {
  private readonly logger = new Logger(RecycleService.name);

  constructor(
    @InjectRepository(FeedbackEntity)
    private readonly feedbackRepo: Repository<FeedbackEntity>,
    @InjectRepository(RecycleTaskEntity)
    private readonly recycleTaskRepo: Repository<RecycleTaskEntity>,
    @InjectRepository(DriverEfficiencyEntity)
    private readonly driverEfficiencyRepo: Repository<DriverEfficiencyEntity>,
    @InjectRepository(PublishTaskEntity)
    private readonly publishRepo: Repository<PublishTaskEntity>,
    @InjectRepository(ScriptEntity)
    private readonly scriptRepo: Repository<ScriptEntity>,
    @InjectRepository(TopicEntity)
    private readonly topicRepo: Repository<TopicEntity>,
    private readonly analyzeService: AnalyzeService,
    private readonly topicService: TopicService,
  ) {}

  // —— 回收任务 ——

  async createRecycle(dto: CreateRecycleDto): Promise<{ taskId: number; traceId: string }> {
    const tenantId = TenantContext.requireTenantId();
    const task = this.recycleTaskRepo.create({
      tenantId,
      scope: dto.scope,
      targetRef: String(dto.targetRef),
      status: RecycleStatus.Running,
      progress: 0,
    });
    const saved = await this.recycleTaskRepo.save(task);
    try {
      const { videoCount } = await this.runCollection(saved);
      if (videoCount === 0) {
        saved.status = RecycleStatus.Failed;
        await this.recycleTaskRepo.save(saved);
        throw new AppError('RECYCLE_NO_DATA');
      }
      const eff = await this.computeDriverEfficiency(tenantId);
      await this.topicService.reweightByEfficiency(
        eff.map((e) => ({ driver: e.driver, emotion: e.emotion, avgConversion: e.avgConversion })),
      );
      saved.status = RecycleStatus.Done;
      saved.progress = 100;
      saved.lastCollectedAt = new Date();
      await this.recycleTaskRepo.save(saved);
      return { taskId: saved.id, traceId: TenantContext.getTraceId() ?? '' };
    } catch (err) {
      if (saved.status !== RecycleStatus.Failed) {
        saved.status = RecycleStatus.Failed;
        await this.recycleTaskRepo.save(saved).catch(() => undefined);
      }
      throw err;
    }
  }

  async getRecycle(id: number): Promise<RecycleTaskEntity> {
    const tenantId = TenantContext.requireTenantId();
    const task = await this.recycleTaskRepo.findOne({ where: { id, tenantId } });
    if (!task) throw new AppError('RECYCLE_TASK_NOT_FOUND');
    return task;
  }

  /**
   * 批量建立"视频维度"回收任务（供自动化 verify 阶段调用）。
   * 每个 publishTaskId 一条 scope=video 的回收任务；返回实体数组。
   */
  async createVideoRecycleTasks(
    publishTaskIds: number[],
    _metric: string,
  ): Promise<RecycleTaskEntity[]> {
    const tenantId = TenantContext.requireTenantId();
    const tasks: RecycleTaskEntity[] = [];
    for (const pubId of publishTaskIds) {
      const task = this.recycleTaskRepo.create({
        tenantId,
        scope: RecycleScope.Video,
        targetRef: String(pubId),
        status: RecycleStatus.Running,
        progress: 0,
      });
      tasks.push(await this.recycleTaskRepo.save(task));
    }
    return tasks;
  }

  /**
   * 回收 + 度量评分（供自动化 verify 阶段按不同 metric 维度执行 5 种策略）。
   * 复用内部 runCollection/computeDriverEfficiency，并反哺 E 选题权重。
   */
  async collectAndScore(
    taskId: number,
    _opts: { metric?: string } = {},
  ): Promise<{
    taskId: number;
    status: string;
  }> {
    const task = await this.getRecycle(taskId);
    const { videoCount } = await this.runCollection(task);
    if (videoCount === 0) {
      task.status = RecycleStatus.Failed;
      await this.recycleTaskRepo.save(task);
      return { taskId, status: RecycleStatus.Failed };
    }
    const eff = await this.computeDriverEfficiency(task.tenantId);
    await this.topicService.reweightByEfficiency(
      eff.map((e) => ({ driver: e.driver, emotion: e.emotion, avgConversion: e.avgConversion })),
    );
    task.status = RecycleStatus.Done;
    task.progress = 100;
    task.lastCollectedAt = new Date();
    await this.recycleTaskRepo.save(task);
    return { taskId, status: RecycleStatus.Done };
  }

  // —— 看板 ——

  /** 反馈指标累计（?? 缺省 0 的读取集中于此，主函数不再背分支） */
  private static sumMetrics(feedbacks: FeedbackEntity[]): {
    totalPlay: number;
    completeSum: number;
    totalInteract: number;
    totalFanInc: number;
    totalCommission: number;
  } {
    const acc = {
      totalPlay: 0,
      completeSum: 0,
      totalInteract: 0,
      totalFanInc: 0,
      totalCommission: 0,
    };
    for (const f of feedbacks) {
      const m = f.metrics ?? {};
      acc.totalPlay += m.play ?? 0;
      acc.completeSum += m.completeRate ?? 0;
      acc.totalInteract += m.interact ?? 0;
      acc.totalFanInc += m.fanInc ?? 0;
      acc.totalCommission += m.commission ?? 0;
    }
    return acc;
  }

  /** 占比率：分母为 0 时回落 0，保留 4 位小数 */
  private static rate(num: number, den: number): number {
    return den ? Number((num / den).toFixed(4)) : 0;
  }

  async getDashboardOverview(): Promise<{
    totalPlay: number;
    avgCompleteRate: number;
    totalInteract: number;
    totalFanInc: number;
    totalCommission: number;
    completeRate: number;
    interactRate: number;
    fanRate: number;
    conversionRate: number;
    videoCount: number;
  }> {
    const tenantId = TenantContext.requireTenantId();
    const feedbacks = await this.feedbackRepo.find({ where: { tenantId } });
    if (!feedbacks.length) throw new AppError('RECYCLE_NO_DATA');

    const acc = RecycleService.sumMetrics(feedbacks);
    const n = feedbacks.length;
    const avgCompleteRate = Number((acc.completeSum / n).toFixed(4));
    return {
      totalPlay: acc.totalPlay,
      avgCompleteRate,
      totalInteract: acc.totalInteract,
      totalFanInc: acc.totalFanInc,
      totalCommission: acc.totalCommission,
      completeRate: avgCompleteRate,
      interactRate: RecycleService.rate(acc.totalInteract, acc.totalPlay),
      fanRate: RecycleService.rate(acc.totalFanInc, acc.totalPlay),
      conversionRate: RecycleService.rate(acc.totalCommission, acc.totalPlay),
      videoCount: n,
    };
  }

  async getDriverEfficiency(): Promise<DriverEfficiencyEntity[]> {
    const tenantId = TenantContext.requireTenantId();
    const rows = await this.driverEfficiencyRepo.find({
      where: { tenantId },
      order: { avgPlay: 'DESC' },
    });
    if (rows.length) return rows;
    // 兜底：尚未跑回收任务时按当前反馈实时计算
    return this.computeDriverEfficiency(tenantId);
  }

  // —— 单视频明细 ——

  async getFeedback(
    videoId: number,
  ): Promise<{ feedback: FeedbackEntity; reanalysisStatus?: string }> {
    const tenantId = TenantContext.requireTenantId();
    const feedback = await this.feedbackRepo.findOne({ where: { tenantId, videoId } });
    if (!feedback) throw new AppError('FEEDBACK_NOT_FOUND');
    let reanalysisStatus: string | undefined;
    if (feedback.reAnalysisId != null) {
      try {
        const t = await this.analyzeService.getAnalysisTask(feedback.reAnalysisId);
        reanalysisStatus = t.status;
      } catch {
        reanalysisStatus = 'unknown';
      }
    }
    return { feedback, reanalysisStatus };
  }

  // —— 回流再分析 ——

  /** 按 attributionId 归并有评论的反馈（无评论的反馈跳过） */
  private static groupCommentsByAttribution(feedbacks: FeedbackEntity[]): Map<string, string[]> {
    const byAttr = new Map<string, string[]>();
    for (const f of feedbacks) {
      if (!f.comments?.length) continue;
      const list = byAttr.get(f.attributionId) ?? [];
      list.push(...f.comments);
      byAttr.set(f.attributionId, list);
    }
    return byAttr;
  }

  async rerunAnalysis(): Promise<{ analysisId: number; traceId: string; feedbackCount: number }> {
    const tenantId = TenantContext.requireTenantId();
    const feedbacks = await this.feedbackRepo.find({ where: { tenantId } });
    if (!feedbacks.length) throw new AppError('RECYCLE_NO_DATA');

    const byAttr = RecycleService.groupCommentsByAttribution(feedbacks);
    if (!byAttr.size) throw new AppError('RECYCLE_NO_DATA');

    let analysisId = 0;
    let feedbackCount = 0;
    for (const [attr, comments] of byAttr) {
      const { taskId } = await this.analyzeService.reanalyzeFromRecycle(comments, attr);
      if (!analysisId) analysisId = taskId;
      await this.feedbackRepo.update({ tenantId, attributionId: attr }, { reAnalysisId: taskId });
      feedbackCount++;
    }
    return { analysisId, traceId: TenantContext.getTraceId() ?? '', feedbackCount };
  }

  // —— 内部 ——

  /** 解析数字型 targetRef（空白/非数字抛 RECYCLE_TARGET_INVALID） */
  private static parseTargetRef(targetRef: string): number {
    const ref = Number(targetRef);
    if (targetRef.trim() === '' || !Number.isFinite(ref)) {
      throw new AppError('RECYCLE_TARGET_INVALID');
    }
    return ref;
  }

  /** 按回收范围追加过滤（video 按任务 id / account 按发布账号；全量范围不加过滤） */
  private applyScopeFilter(
    qb: SelectQueryBuilder<PublishTaskEntity>,
    task: RecycleTaskEntity,
  ): void {
    if (task.scope === RecycleScope.Video) {
      qb.andWhere('p.id = :id', { id: RecycleService.parseTargetRef(task.targetRef) });
    } else if (task.scope === RecycleScope.Account) {
      qb.andWhere('p.account_id = :acc', { acc: RecycleService.parseTargetRef(task.targetRef) });
    }
  }

  private async runCollection(
    task: RecycleTaskEntity,
  ): Promise<{ videoCount: number; commentCount: number }> {
    const tenantId = TenantContext.requireTenantId();
    const qb = this.publishRepo
      .createQueryBuilder('p')
      .where('p.tenant_id = :tenantId', { tenantId });
    this.applyScopeFilter(qb, task);

    const publishes = await qb.getMany();
    let videoCount = 0;
    let commentCount = 0;
    for (const pub of publishes) {
      const fb = await this.collectOne(pub, tenantId);
      if (fb) {
        videoCount++;
        commentCount += fb.comments?.length ?? 0;
      }
    }
    return { videoCount, commentCount };
  }

  /** 模拟「五维」回流指标（ext_post_id 为确定性种子，同一发布多次回收结果稳定） */
  private static mockMetrics(extPostId: string | null | undefined, pubId: number): RecycleMetrics {
    const seed = hashSeed(extPostId || `${pubId}`);
    const play = 1000 + (seed % 90000);
    return {
      play,
      completeRate: Number((0.3 + (seed % 6000) / 10000).toFixed(4)),
      interact: Math.floor(play * (0.02 + (seed % 600) / 10000)),
      fanInc: Math.floor(play * 0.01),
      commission: Number((play * 0.0005 * (1 + (seed % 100) / 100)).toFixed(2)),
    };
  }

  /** 由发布任务回溯关联 选题（脚本缺失/无 topicId 时为 null） */
  private async resolveTopic(
    pub: PublishTaskEntity,
    tenantId: string,
  ): Promise<TopicEntity | null> {
    const script = pub.scriptId
      ? await this.scriptRepo.findOne({ where: { id: pub.scriptId, tenantId } })
      : null;
    if (!script?.topicId) return null;
    return this.topicRepo.findOne({ where: { id: script.topicId, tenantId } });
  }

  /** 模拟评论（按选题人性/情绪取值，缺失回落默认标签） */
  private static mockComments(topic: TopicEntity | null): string[] {
    const driverLabel = topic?.humanDriver ?? '贪';
    const emotionLabel = topic?.emotion ?? '好奇';
    return [
      `这条讲${driverLabel}的内容太戳我了，${emotionLabel}到不行`,
      `看完直接下单了，求${driverLabel}更多选题`,
      `第N次刷到，还是被${emotionLabel}到`,
    ];
  }

  private async collectOne(
    pub: PublishTaskEntity,
    tenantId: string,
  ): Promise<FeedbackEntity | null> {
    const topic = await this.resolveTopic(pub, tenantId);
    const feedback = this.feedbackRepo.create({
      tenantId,
      topicId: topic?.id ?? null,
      videoId: pub.id,
      platform: pub.platform,
      attributionId: pub.attributionId, // 透传 I：F→I→J 只读，禁止重生成
      metrics: RecycleService.mockMetrics(pub.extPostId, pub.id),
      comments: RecycleService.mockComments(topic),
      reAnalysisId: null,
      collectedAt: new Date(),
    });
    return this.feedbackRepo.save(feedback);
  }

  /** 效能分组桶（按 人性|情绪 聚合的指标样本） */
  private static newBucket(driver: string, emotion: string) {
    return {
      driver,
      emotion,
      plays: [] as number[],
      completes: [] as number[],
      interacts: [] as number[],
      conversions: [] as number[],
      count: 0,
    };
  }

  /** 指标读取：null/undefined 回落 0（?? 分支集中于此，聚合主流程不再背分支） */
  private static numOrZero(v: number | null | undefined): number {
    return v ?? 0;
  }

  /** 单条反馈样本并入分组桶（五维指标的 ?? 缺省集中于此） */
  private static pushSample(
    grp: ReturnType<typeof RecycleService.newBucket>,
    m: RecycleMetrics,
  ): void {
    grp.plays.push(RecycleService.numOrZero(m.play));
    grp.completes.push(RecycleService.numOrZero(m.completeRate));
    grp.interacts.push(RecycleService.numOrZero(m.interact));
    grp.conversions.push(RecycleService.numOrZero(m.commission));
    grp.count += 1;
  }

  /** 按 (人性,情绪) 聚合反馈样本（topic 已删的反馈跳过） */
  private static groupByDriver(
    feedbacks: FeedbackEntity[],
    topicMap: Map<number, TopicEntity>,
  ): Map<string, ReturnType<typeof RecycleService.newBucket>> {
    const groups = new Map<string, ReturnType<typeof RecycleService.newBucket>>();
    for (const f of feedbacks) {
      if (f.topicId == null) continue;
      const topic = topicMap.get(f.topicId);
      if (!topic) continue;
      const key = `${topic.humanDriver}|${topic.emotion}`;
      const grp = groups.get(key) ?? RecycleService.newBucket(topic.humanDriver, topic.emotion);
      RecycleService.pushSample(grp, f.metrics ?? {});
      groups.set(key, grp);
    }
    return groups;
  }

  /** 按 (人性,情绪) 聚合反馈，计算人性效能并 upsert 到 ops_driver_efficiency（window=day） */
  private async computeDriverEfficiency(tenantId: string): Promise<DriverEfficiencyEntity[]> {
    const feedbacks = await this.feedbackRepo.find({ where: { tenantId } });
    if (!feedbacks.length) return [];
    const topicIds = Array.from(
      new Set(feedbacks.map((f) => f.topicId).filter((id): id is number => !!id)),
    );
    const topics = topicIds.length
      ? await this.topicRepo.find({ where: { tenantId, id: In(topicIds) } })
      : [];
    const topicMap = new Map(topics.map((t) => [t.id, t]));
    const groups = RecycleService.groupByDriver(feedbacks, topicMap);

    const avg = (a: number[]): number => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
    const rate = (num: number, den: number): number => (den ? Number((num / den).toFixed(4)) : 0);
    const today = startOfToday();
    const rows: DriverEfficiencyEntity[] = [];
    for (const grp of groups.values()) {
      const sum = (a: number[]): number => a.reduce((s, x) => s + x, 0);
      const totalPlay = sum(grp.plays);
      rows.push(
        this.driverEfficiencyRepo.create({
          tenantId,
          driver: grp.driver,
          emotion: grp.emotion,
          sampleCount: grp.count,
          avgPlay: Math.round(avg(grp.plays)),
          avgCompleteRate: Number(avg(grp.completes).toFixed(4)),
          avgInteractRate: rate(sum(grp.interacts), totalPlay),
          avgConversion: rate(sum(grp.conversions), totalPlay),
          window: 'day',
          statDate: today,
        }),
      );
    }
    await this.driverEfficiencyRepo.delete({ tenantId, window: 'day', statDate: today });
    await this.driverEfficiencyRepo.save(rows);
    return rows;
  }
}
