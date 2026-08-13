import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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
    let totalPlay = 0;
    let totalInteract = 0;
    let totalFanInc = 0;
    let totalCommission = 0;
    let completeSum = 0;
    for (const f of feedbacks) {
      const m = f.metrics ?? {};
      totalPlay += m.play ?? 0;
      completeSum += m.completeRate ?? 0;
      totalInteract += m.interact ?? 0;
      totalFanInc += m.fanInc ?? 0;
      totalCommission += m.commission ?? 0;
    }
    const n = feedbacks.length;
    const avgCompleteRate = Number((completeSum / n).toFixed(4));
    const interactRate = totalPlay ? Number((totalInteract / totalPlay).toFixed(4)) : 0;
    const fanRate = totalPlay ? Number((totalFanInc / totalPlay).toFixed(4)) : 0;
    const conversionRate = totalPlay ? Number((totalCommission / totalPlay).toFixed(4)) : 0;
    return {
      totalPlay,
      avgCompleteRate,
      totalInteract,
      totalFanInc,
      totalCommission,
      completeRate: avgCompleteRate,
      interactRate,
      fanRate,
      conversionRate,
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

  async rerunAnalysis(): Promise<{ analysisId: number; traceId: string; feedbackCount: number }> {
    const tenantId = TenantContext.requireTenantId();
    const feedbacks = await this.feedbackRepo.find({ where: { tenantId } });
    if (!feedbacks.length) throw new AppError('RECYCLE_NO_DATA');

    const byAttr = new Map<string, string[]>();
    for (const f of feedbacks) {
      if (!f.comments?.length) continue;
      const list = byAttr.get(f.attributionId) ?? [];
      list.push(...f.comments);
      byAttr.set(f.attributionId, list);
    }
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

  private async runCollection(
    task: RecycleTaskEntity,
  ): Promise<{ videoCount: number; commentCount: number }> {
    const tenantId = TenantContext.requireTenantId();
    const qb = this.publishRepo
      .createQueryBuilder('p')
      .where('p.tenant_id = :tenantId', { tenantId });
    if (task.scope === RecycleScope.Video) {
      const ref = Number(task.targetRef);
      if (task.targetRef.trim() !== '' && Number.isFinite(ref)) {
        qb.andWhere('p.id = :id', { id: ref });
      } else {
        throw new AppError('RECYCLE_TARGET_INVALID');
      }
    } else if (task.scope === RecycleScope.Account) {
      const accId = Number(task.targetRef);
      if (task.targetRef.trim() !== '' && Number.isFinite(accId)) {
        qb.andWhere('p.account_id = :acc', { acc: accId });
      } else {
        throw new AppError('RECYCLE_TARGET_INVALID');
      }
    }
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

  private async collectOne(
    pub: PublishTaskEntity,
    tenantId: string,
  ): Promise<FeedbackEntity | null> {
    const script = pub.scriptId
      ? await this.scriptRepo.findOne({ where: { id: pub.scriptId, tenantId } })
      : null;
    const topic = script?.topicId
      ? await this.topicRepo.findOne({ where: { id: script.topicId, tenantId } })
      : null;
    const seed = hashSeed(pub.extPostId || `${pub.id}`);
    const play = 1000 + (seed % 90000);
    const metrics: RecycleMetrics = {
      play,
      completeRate: Number((0.3 + (seed % 6000) / 10000).toFixed(4)),
      interact: Math.floor(play * (0.02 + (seed % 600) / 10000)),
      fanInc: Math.floor(play * 0.01),
      commission: Number((play * 0.0005 * (1 + (seed % 100) / 100)).toFixed(2)),
    };
    const driverLabel = topic?.humanDriver ?? '贪';
    const emotionLabel = topic?.emotion ?? '好奇';
    const comments = [
      `这条讲${driverLabel}的内容太戳我了，${emotionLabel}到不行`,
      `看完直接下单了，求${driverLabel}更多选题`,
      `第N次刷到，还是被${emotionLabel}到`,
    ];
    const feedback = this.feedbackRepo.create({
      tenantId,
      topicId: topic?.id ?? null,
      videoId: pub.id,
      platform: pub.platform,
      attributionId: pub.attributionId, // 透传 I：F→I→J 只读，禁止重生成
      metrics,
      comments,
      reAnalysisId: null,
      collectedAt: new Date(),
    });
    return this.feedbackRepo.save(feedback);
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

    const groups = new Map<
      string,
      {
        driver: string;
        emotion: string;
        plays: number[];
        completes: number[];
        interacts: number[];
        conversions: number[];
        count: number;
      }
    >();
    for (const f of feedbacks) {
      const topic = f.topicId != null ? topicMap.get(f.topicId) : undefined;
      if (!topic) continue;
      const key = `${topic.humanDriver}|${topic.emotion}`;
      const m = f.metrics ?? {};
      const grp = groups.get(key) ?? {
        driver: topic.humanDriver,
        emotion: topic.emotion,
        plays: [],
        completes: [],
        interacts: [],
        conversions: [],
        count: 0,
      };
      grp.plays.push(m.play ?? 0);
      grp.completes.push(m.completeRate ?? 0);
      grp.interacts.push(m.interact ?? 0);
      grp.conversions.push(m.commission ?? 0);
      grp.count += 1;
      groups.set(key, grp);
    }

    const avg = (a: number[]): number => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
    const today = startOfToday();
    const rows: DriverEfficiencyEntity[] = [];
    for (const grp of groups.values()) {
      const totalPlay = grp.plays.reduce((s, x) => s + x, 0);
      const totalInteract = grp.interacts.reduce((s, x) => s + x, 0);
      const totalCommission = grp.conversions.reduce((s, x) => s + x, 0);
      rows.push(
        this.driverEfficiencyRepo.create({
          tenantId,
          driver: grp.driver,
          emotion: grp.emotion,
          sampleCount: grp.count,
          avgPlay: Math.round(avg(grp.plays)),
          avgCompleteRate: Number(avg(grp.completes).toFixed(4)),
          avgInteractRate: totalPlay ? Number((totalInteract / totalPlay).toFixed(4)) : 0,
          avgConversion: totalPlay ? Number((totalCommission / totalPlay).toFixed(4)) : 0,
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
