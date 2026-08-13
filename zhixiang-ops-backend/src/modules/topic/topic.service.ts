import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppError } from '../../shared/app-error';
import { buildPage, pageOffset, PaginatedResult } from '../../shared/pagination';
import { TenantContext } from '../../tenant/tenant-context';
import { generateAttributionId } from '../../core/attribution-id';
import { HumanInsightEntity } from '../analyze/human-insight.entity';
import { AnalysisTaskEntity } from '../analyze/analysis-task.entity';
import {
  EMOTION_TYPES,
  EmotionType,
  HUMANITY_DRIVERS,
  HumanityDriver,
} from '../analyze/analyze.types';
import { AccountEntity } from '../account/account.entity';
import { TopicEntity } from './topic.entity';
import { canTransition, TopicStatus } from './topic.types';
import { GenerateTopicsDto } from './dto/generate-topics.dto';
import { UpdateTopicDto } from './dto/update-topic.dto';
import { TopicQueryDto } from './dto/topic-query.dto';
import { AbVariantDto } from './dto/ab-variant.dto';
import { ScheduleTopicDto } from './dto/schedule-topic.dto';

/** 选题 prompt 版本（便于回溯） */
const PROMPT_VERSION = 'v1';
/** 单批生成上限 */
const MAX_CANDIDATES = 50;

/**
 * 选题引擎服务（规划 §4-E）。
 * 职责：消费 D 洞察库（或指定分析任务）→ 生成选题（归因标识 + 去重 + 综合评分）
 * → 状态机流转 → A/B 变体派生 → 排期绑定 B 账号。
 * 全部按 tenantId 隔离；仅存聚合洞察结论与选题元数据（合规边界②）。
 */
@Injectable()
export class TopicService {
  private readonly logger = new Logger(TopicService.name);

  constructor(
    @InjectRepository(TopicEntity)
    private readonly topicRepo: Repository<TopicEntity>,
    @InjectRepository(HumanInsightEntity)
    private readonly insightRepo: Repository<HumanInsightEntity>,
    @InjectRepository(AnalysisTaskEntity)
    private readonly analysisRepo: Repository<AnalysisTaskEntity>,
    @InjectRepository(AccountEntity)
    private readonly accountRepo: Repository<AccountEntity>,
  ) {}

  // —— 选题生成 ——

  /**
   * 由 D 洞察库（或指定分析任务）聚合生成选题。
   * 返回本次新创建的选题（去重跳过已存在者）；无可用洞察则返回空列表。
   */
  async generateTopics(
    dto: GenerateTopicsDto,
  ): Promise<{ topics: TopicEntity[]; traceId: string }> {
    const tenantId = TenantContext.requireTenantId();
    if (dto.driver && !HUMANITY_DRIVERS.includes(dto.driver as HumanityDriver)) {
      throw new AppError('HUMANITY_INVALID');
    }
    if (dto.emotion && !EMOTION_TYPES.includes(dto.emotion as EmotionType)) {
      throw new AppError('EMOTION_INVALID');
    }

    const candidates = await this.buildCandidates(tenantId, dto);
    const created: TopicEntity[] = [];
    for (const c of candidates) {
      // 去重：同租户 + 标题 + 人性 + 情绪 已存在则跳过（避免重复选题）
      const dup = await this.topicRepo.findOne({
        where: { tenantId, title: c.title, humanDriver: c.humanDriver, emotion: c.emotion },
      });
      if (dup) continue;

      const topic = this.topicRepo.create({
        tenantId,
        analysisId: dto.analysisId,
        attributionId: generateAttributionId(
          tenantId,
          'content',
          `${c.title}|${c.humanDriver}|${c.emotion}|${Date.now()}`,
        ),
        title: c.title,
        humanDriver: c.humanDriver,
        emotion: c.emotion,
        formulaTags: c.formulaTags,
        status: TopicStatus.Idea,
        score: c.score,
        promptVersion: PROMPT_VERSION,
        modelUsed: '',
      });
      created.push(await this.topicRepo.save(topic));
    }
    return { topics: created, traceId: TenantContext.getTraceId() ?? '' };
  }

  /** 组装候选选题：来自洞察库（按 usageCount 降序）或指定分析任务的 insights */
  private async buildCandidates(
    tenantId: string,
    dto: GenerateTopicsDto,
  ): Promise<
    { title: string; humanDriver: string; emotion: string; formulaTags: string[]; score: number }[]
  > {
    const limit = Math.min(dto.limit ?? 20, MAX_CANDIDATES);
    let rows: {
      title: string;
      driver: string;
      emotion: string;
      tags?: string[];
      usageCount: number;
    }[] = [];

    if (dto.analysisId) {
      const analysis = await this.analysisRepo.findOne({ where: { id: dto.analysisId, tenantId } });
      if (!analysis) throw new AppError('ANALYSIS_TASK_NOT_FOUND');
      const ins = (analysis.insights ?? [])
        .filter(
          (i) =>
            (!dto.driver || i.driver === dto.driver) && (!dto.emotion || i.emotion === dto.emotion),
        )
        .map((i) => ({
          title: i.title,
          driver: i.driver,
          emotion: i.emotion,
          tags: i.tags,
          usageCount: 0,
        }));
      rows = ins;
    } else {
      const qb = this.insightRepo
        .createQueryBuilder('i')
        .where('i.tenant_id = :tenantId', { tenantId });
      if (dto.driver) qb.andWhere('i.driver = :driver', { driver: dto.driver });
      if (dto.emotion) qb.andWhere('i.emotion = :emotion', { emotion: dto.emotion });
      qb.orderBy('i.usageCount', 'DESC').addOrderBy('i.created_at', 'DESC').take(limit);
      const ins = await qb.getMany();
      rows = ins.map((i) => ({
        title: i.title,
        driver: i.driver,
        emotion: i.emotion,
        tags: i.tags,
        usageCount: i.usageCount,
      }));
    }

    return rows.slice(0, limit).map((r) => ({
      title: r.title,
      humanDriver: r.driver,
      emotion: r.emotion,
      formulaTags: r.tags ?? [],
      // 综合评分：基准 50 + 洞察复用度（usageCount）权重，封顶 100
      score: Math.min(100, 50 + r.usageCount * 5),
    }));
  }

  // —— 列表 / 详情 ——

  async listTopics(query: TopicQueryDto): Promise<PaginatedResult<TopicEntity>> {
    const tenantId = TenantContext.requireTenantId();
    const { skip, take } = pageOffset(query.page, query.pageSize);
    const qb = this.topicRepo
      .createQueryBuilder('t')
      .where('t.tenant_id = :tenantId', { tenantId });
    if (query.driver) qb.andWhere('t.human_driver = :driver', { driver: query.driver });
    if (query.emotion) qb.andWhere('t.emotion = :emotion', { emotion: query.emotion });
    if (query.status) qb.andWhere('t.status = :status', { status: query.status });
    qb.orderBy('t.score', 'DESC').addOrderBy('t.created_at', 'DESC').skip(skip).take(take);

    const [rows, total] = await qb.getManyAndCount();
    return buildPage(rows, total, query.page ?? 1, query.pageSize ?? 20);
  }

  async getTopic(id: number): Promise<TopicEntity> {
    const tenantId = TenantContext.requireTenantId();
    const topic = await this.topicRepo.findOne({ where: { id, tenantId } });
    if (!topic) throw new AppError('TOPIC_NOT_FOUND');
    return topic;
  }

  // —— 更新 / 状态机 ——

  async updateTopic(id: number, dto: UpdateTopicDto): Promise<TopicEntity> {
    const tenantId = TenantContext.requireTenantId();
    const topic = await this.topicRepo.findOne({ where: { id, tenantId } });
    if (!topic) throw new AppError('TOPIC_NOT_FOUND');

    if (dto.humanDriver !== undefined) {
      if (!HUMANITY_DRIVERS.includes(dto.humanDriver as HumanityDriver))
        throw new AppError('HUMANITY_INVALID');
      topic.humanDriver = dto.humanDriver;
    }
    if (dto.emotion !== undefined) {
      if (!EMOTION_TYPES.includes(dto.emotion as EmotionType))
        throw new AppError('EMOTION_INVALID');
      topic.emotion = dto.emotion;
    }
    if (dto.title !== undefined) topic.title = dto.title;
    if (dto.formulaTags !== undefined) topic.formulaTags = dto.formulaTags;
    if (dto.score !== undefined) topic.score = dto.score;
    if (dto.scheduledAt !== undefined) topic.scheduledAt = new Date(dto.scheduledAt);
    if (dto.accountId !== undefined) topic.accountId = dto.accountId;

    if (dto.status !== undefined) {
      if (!canTransition(topic.status, dto.status as TopicStatus)) {
        throw new AppError('INVALID_STATUS_TRANSITION');
      }
      topic.status = dto.status as TopicStatus;
    }
    return this.topicRepo.save(topic);
  }

  // —— A/B 变体 ——

  /** 基于基准选题派生 A/B 变体；不允许对变体再建变体（防环） */
  async createAbVariant(id: number, dto: AbVariantDto): Promise<TopicEntity> {
    const tenantId = TenantContext.requireTenantId();
    const base = await this.topicRepo.findOne({ where: { id, tenantId } });
    if (!base) throw new AppError('TOPIC_NOT_FOUND');
    if (base.abVariantOf) throw new AppError('INVALID_AB_VARIANT_CYCLE');

    if (
      dto.humanDriver !== undefined &&
      !HUMANITY_DRIVERS.includes(dto.humanDriver as HumanityDriver)
    ) {
      throw new AppError('HUMANITY_INVALID');
    }
    if (dto.emotion !== undefined && !EMOTION_TYPES.includes(dto.emotion as EmotionType)) {
      throw new AppError('EMOTION_INVALID');
    }

    const variant = this.topicRepo.create({
      tenantId,
      analysisId: base.analysisId,
      attributionId: generateAttributionId(
        tenantId,
        'content',
        `${dto.title ?? base.title}|${dto.humanDriver ?? base.humanDriver}|${Date.now()}`,
      ),
      title: dto.title ?? `${base.title} (A/B)`,
      humanDriver: dto.humanDriver ?? base.humanDriver,
      emotion: dto.emotion ?? base.emotion,
      formulaTags: dto.formulaTags ?? base.formulaTags,
      status: TopicStatus.Idea,
      score: base.score,
      abVariantOf: base.id,
      promptVersion: PROMPT_VERSION,
      modelUsed: '',
    });
    if (dto.scheduledAt) variant.scheduledAt = new Date(dto.scheduledAt);
    if (dto.accountId) variant.accountId = dto.accountId;
    return this.topicRepo.save(variant);
  }

  // —— 排期 ——

  /** 绑定发布时间与可选账号；终态（published/dead）不可排期 */
  async scheduleTopic(id: number, dto: ScheduleTopicDto): Promise<TopicEntity> {
    const tenantId = TenantContext.requireTenantId();
    const topic = await this.topicRepo.findOne({ where: { id, tenantId } });
    if (!topic) throw new AppError('TOPIC_NOT_FOUND');
    if (topic.status === TopicStatus.Published || topic.status === TopicStatus.Dead) {
      throw new AppError('INVALID_STATUS_TRANSITION');
    }
    if (dto.accountId) {
      const acc = await this.accountRepo.findOne({ where: { id: dto.accountId, tenantId } });
      if (!acc) throw new AppError('SCHEDULE_ACCOUNT_NOT_FOUND');
      topic.accountId = dto.accountId;
    }
    topic.scheduledAt = new Date(dto.scheduledAt);
    return this.topicRepo.save(topic);
  }

  // —— 回收反哺（J → E 权重） ——

  /**
   * J 回收的人性效能（driver_efficiency）回流：将转化率最高的人性维度作为高价值信号，
   * 对其命中的选题 score +8（封顶 100），使高转化人性的选题在下一轮 E 生成中自然上浮。
   * 返回被调整的选题数量。无数据则直接返回 0。
   */
  async reweightByEfficiency(
    rows: { driver: string; emotion: string; avgConversion: number }[],
  ): Promise<number> {
    if (!rows.length) return 0;
    const tenantId = TenantContext.requireTenantId();
    const topDrivers = Array.from(
      new Set(
        rows
          .slice()
          .sort((a, b) => b.avgConversion - a.avgConversion)
          .map((r) => r.driver),
      ),
    ).slice(0, 3);

    const qb = this.topicRepo
      .createQueryBuilder('t')
      .where('t.tenant_id = :tenantId', { tenantId })
      .andWhere('t.human_driver IN (:...drivers)', { drivers: topDrivers })
      .andWhere('t.score < 100');
    const targets = await qb.getMany();
    for (const t of targets) {
      t.score = Math.min(100, t.score + 8);
    }
    if (targets.length) await this.topicRepo.save(targets);
    return targets.length;
  }
}
