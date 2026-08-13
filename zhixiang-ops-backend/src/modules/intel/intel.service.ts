import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { AppError } from '../../shared/app-error';
import { buildPage, pageOffset } from '../../shared/pagination';
import { TenantContext } from '../../tenant/tenant-context';
import { CollectRateLimiter } from './rate-limiter';
import { CollectorGateway } from './collector/collector.gateway';
import { CollectSourceType, CollectTaskStatus, HotType } from './intel.types';
import { CompetitorEntity } from './competitor.entity';
import { CollectedCommentEntity } from './collected-comment.entity';
import { CollectTaskEntity } from './collect-task.entity';
import { HotSnapshotEntity } from './hot-snapshot.entity';
import { CreateCompetitorDto } from './dto/create-competitor.dto';
import { UpdateCompetitorDto } from './dto/update-competitor.dto';
import { CreateCollectTaskDto } from './dto/create-collect-task.dto';
import { CollectedCommentQueryDto } from './dto/collected-comment-query.dto';
import { KeywordMineDto } from './dto/keyword-mine.dto';

/** 字段白名单（合规边界①）：采集评论仅允许落库这些公开字段 */
const ALLOWED_FIELDS = ['content', 'authorId', 'likes', 'platform', 'sourceRef', 'collectedAt'];

/**
 * 隐私命中模式（合规边界②，规划 §13 六类）：手机 / 地理 / IMEI / 身份证 / 精确定位 / 个体画像。
 * 命中即剥离为 [已脱敏] 并写入 clean_result.piiRemoved 审计。
 * 注意：15 位旧版身份证与 IMEI 同为 15 位纯数字，统一由 imei 模式剥离（脱敏效果等价）。
 */
const PII_PATTERNS: Array<[string, RegExp]> = [
  ['phone', /\b1[3-9]\d{9}\b/g],
  [
    'geo',
    /(北京|上海|广州|深圳|杭州|成都|重庆|武汉|西安|苏州|南京|天津|长沙|郑州|青岛|沈阳|青岛)(市|城区|新区|区|县|路|街|号)?/g,
  ],
  ['imei', /\b\d{15}\b/g],
  ['id_card', /\b\d{17}[\dXx]\b/g],
  ['precise_location', /\b\d{1,3}\.\d{4,},\s*[-+]?\d{1,3}\.\d{4,}\b/g],
  [
    'individual_profile',
    /(?:出生于|出生日期|生日|身高|体重|家庭住址|现住址|常住地址|身份证号|手机号码|联系电话|家庭收入|月收入|年收入|家庭成员|银行卡号|职业)[^\n\r，。；;！!？?]{0,20}/g,
  ],
];

/** 广告词（命中则判定为未过清洗） */
const AD_KEYWORDS = [
  '加微信',
  '私聊',
  '代购',
  '加我',
  'vx',
  '微信',
  '微信号',
  '内部价',
  '私域',
  '联系我',
];

const RATE_CAPACITY = 10;
const RATE_REFILL_PER_SEC = 1 / 6; // 10 次/分钟

/**
 * 情报采集服务（规划 §4-C）。
 * 职责：竞品 CRUD + 监控开关、采集任务异步调度、评论清洗去重（PII 剥离/广告识别）、
 * 字段白名单合规审计、令牌桶限频、热点追踪、关键词挖掘、供 D 消费的干净评论分页。
 * 全部按 tenantId 隔离（TenantContext.requireTenantId + 显式 where）。
 */
@Injectable()
export class IntelService {
  private readonly logger = new Logger(IntelService.name);

  constructor(
    @InjectRepository(CompetitorEntity)
    private readonly competitorRepo: Repository<CompetitorEntity>,
    @InjectRepository(CollectedCommentEntity)
    private readonly commentRepo: Repository<CollectedCommentEntity>,
    @InjectRepository(CollectTaskEntity)
    private readonly taskRepo: Repository<CollectTaskEntity>,
    @InjectRepository(HotSnapshotEntity)
    private readonly hotRepo: Repository<HotSnapshotEntity>,
    private readonly rateLimiter: CollectRateLimiter,
    private readonly collectorGateway: CollectorGateway,
  ) {}

  // —— 竞品 ——

  async createCompetitor(dto: CreateCompetitorDto): Promise<CompetitorEntity> {
    const tenantId = TenantContext.requireTenantId();
    const competitor = this.competitorRepo.create({
      tenantId,
      platform: dto.platform,
      name: dto.name,
      url: dto.url,
      category: dto.category,
      monitorEnabled: false,
      healthScore: 0,
    });
    return this.competitorRepo.save(competitor);
  }

  async listCompetitors(): Promise<CompetitorEntity[]> {
    const tenantId = TenantContext.requireTenantId();
    return this.competitorRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOneCompetitor(id: number): Promise<CompetitorEntity> {
    const tenantId = TenantContext.requireTenantId();
    const competitor = await this.competitorRepo.findOne({ where: { id, tenantId } });
    if (!competitor) throw new AppError('COMPETITOR_NOT_FOUND');
    return competitor;
  }

  async updateCompetitor(id: number, dto: UpdateCompetitorDto): Promise<CompetitorEntity> {
    const tenantId = TenantContext.requireTenantId();
    const competitor = await this.competitorRepo.findOne({ where: { id, tenantId } });
    if (!competitor) throw new AppError('COMPETITOR_NOT_FOUND');
    if (dto.name !== undefined) competitor.name = dto.name;
    if (dto.url !== undefined) competitor.url = dto.url;
    if (dto.category !== undefined) competitor.category = dto.category;
    if (dto.monitorEnabled !== undefined) competitor.monitorEnabled = dto.monitorEnabled;
    return this.competitorRepo.save(competitor);
  }

  /** 监控开关（POST /competitors/:id/monitor）：翻转 monitor_enabled */
  async toggleMonitor(id: number): Promise<CompetitorEntity> {
    const tenantId = TenantContext.requireTenantId();
    const competitor = await this.competitorRepo.findOne({ where: { id, tenantId } });
    if (!competitor) throw new AppError('COMPETITOR_NOT_FOUND');
    competitor.monitorEnabled = !competitor.monitorEnabled;
    return this.competitorRepo.save(competitor);
  }

  async removeCompetitor(id: number): Promise<{ id: number }> {
    const tenantId = TenantContext.requireTenantId();
    const competitor = await this.competitorRepo.findOne({ where: { id, tenantId } });
    if (!competitor) throw new AppError('COMPETITOR_NOT_FOUND');
    await this.competitorRepo.softDelete({ id, tenantId });
    return { id };
  }

  // —— 采集任务（异步） ——

  /**
   * 发起采集任务：限频（令牌桶）→ 校验来源级别 → 落 pending。
   * 由 @Cron processPendingTasks 异步处理。返回 { taskId, traceId }。
   */
  async createCollectTask(dto: CreateCollectTaskDto): Promise<{ taskId: number; traceId: string }> {
    const tenantId = TenantContext.requireTenantId();
    const allowed = await this.rateLimiter.allow(
      tenantId,
      dto.platform,
      RATE_CAPACITY,
      RATE_REFILL_PER_SEC,
    );
    if (!allowed) throw new AppError('COLLECT_RATE_LIMITED');
    if (dto.sourceLevel !== 'L1' && dto.sourceLevel !== 'L2') {
      throw new AppError('COLLECT_SOURCE_LEVEL_INVALID');
    }

    const task = this.taskRepo.create({
      tenantId,
      type: dto.type,
      target: dto.target,
      platform: dto.platform,
      sourceLevel: dto.sourceLevel,
      status: CollectTaskStatus.Pending,
      progress: 0,
      collectedCount: 0,
      scope: dto.scope ?? ['comments'],
      fieldsCollected: dto.fieldsCollected ?? ALLOWED_FIELDS,
    });
    const saved = await this.taskRepo.save(task);
    return { taskId: saved.id, traceId: TenantContext.getTraceId() ?? '' };
  }

  async getCollectTask(
    id: number,
  ): Promise<{ status: string; progress: number; collectedCount: number }> {
    const tenantId = TenantContext.requireTenantId();
    const task = await this.taskRepo.findOne({ where: { id, tenantId } });
    if (!task) throw new AppError('COLLECT_TASK_NOT_FOUND');
    return { status: task.status, progress: task.progress, collectedCount: task.collectedCount };
  }

  /**
   * 异步工作器（每 5 秒）：处理 pending 任务 → running → done/failed。
   * 经采集网关取适配器拉取原始数据，清洗去重后落库，回填进度与计数。
   * 跨租户系统任务，tenantId 从任务本身取。
   */
  @Cron(CronExpression.EVERY_5_SECONDS)
  async processPendingTasks(): Promise<void> {
    const pending = await this.taskRepo.find({
      where: { status: CollectTaskStatus.Pending },
      take: 10,
    });
    for (const task of pending) {
      task.status = CollectTaskStatus.Running;
      task.progress = 10;
      await this.taskRepo.save(task);
      try {
        const adapter = this.collectorGateway.resolve(task.platform);
        const raws = await adapter.fetchComments(task);
        const stored = await this.storeCleanComments(raws, task.tenantId, task);
        task.collectedCount = stored.length;
        task.progress = 100;
        task.status = CollectTaskStatus.Done;
        task.finishedAt = new Date();
        await this.taskRepo.save(task);
      } catch (err) {
        task.status = CollectTaskStatus.Failed;
        task.errorMsg = (err as Error).message;
        task.finishedAt = new Date();
        await this.taskRepo.save(task).catch(() => undefined);
      }
    }
  }

  // —— 供 D 消费：干净评论分页 ——

  async findCleanComments(query: CollectedCommentQueryDto): Promise<{
    list: CollectedCommentEntity[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const tenantId = TenantContext.requireTenantId();
    const { skip, take } = pageOffset(query.page, query.pageSize);
    const qb = this.commentRepo
      .createQueryBuilder('c')
      .where('c.tenant_id = :tenantId', { tenantId });
    if (query.isClean !== undefined) {
      qb.andWhere('c.is_clean = :isClean', { isClean: query.isClean });
    }
    if (query.platform) {
      qb.andWhere('c.platform = :platform', { platform: query.platform });
    }
    qb.orderBy('c.collected_at', 'DESC').skip(skip).take(take);

    const [rows, total] = await qb.getManyAndCount();
    return buildPage(rows, total, query.page ?? 1, query.pageSize ?? 20);
  }

  // —— 关键词挖掘 ——

  async mineKeywords(dto: KeywordMineDto): Promise<string[]> {
    TenantContext.requireTenantId();
    const adapter = this.collectorGateway.resolve(dto.platform);
    return adapter.mineKeywords(dto.platform, dto.target);
  }

  // —— 热点追踪 ——

  async getHot(platform?: string, hotType?: string): Promise<HotSnapshotEntity[]> {
    const tenantId = TenantContext.requireTenantId();
    const type = (hotType as HotType) ?? HotType.Video;
    if (platform) {
      const adapter = this.collectorGateway.resolve(platform);
      const raws = await adapter.fetchHot(platform, type);
      const now = new Date();
      for (const r of raws) {
        const snap = this.hotRepo.create({
          tenantId,
          platform,
          hotType: r.hotType,
          title: r.title,
          heat: r.heat,
          url: r.url,
          capturedAt: now,
        });
        await this.hotRepo.save(snap).catch(() => undefined);
      }
    }
    return this.hotRepo.find({
      where: { tenantId },
      order: { capturedAt: 'DESC' },
      take: 50,
    });
  }

  // —— 内部：清洗 / 去重 / 合规 ——

  /**
   * 分析单条评论：剥离隐私（[已脱敏]）并标记广告。
   * 返回清洗后内容与清洗结果（供审计）。
   */
  private analyzeComment(content: string): {
    cleaned: string;
    isClean: boolean;
    cleanResult: Record<string, unknown>;
  } {
    let cleaned = content;
    const piiRemoved: string[] = [];
    for (const [name, re] of PII_PATTERNS) {
      re.lastIndex = 0; // /g 正则复用必须重置 lastIndex，防止跨评论漏剥
      if (re.test(content)) {
        re.lastIndex = 0;
        cleaned = cleaned.replace(re, '[已脱敏]');
        piiRemoved.push(name);
      }
    }
    const ad = AD_KEYWORDS.some((k) => content.toLowerCase().includes(k.toLowerCase()));
    const isClean = piiRemoved.length === 0 && !ad;
    return { cleaned, isClean, cleanResult: { piiRemoved, ad } };
  }

  private hashContent(s: string): string {
    return createHash('sha1').update(s).digest('hex');
  }

  /** 清洗 + 去重（批内 + 跨批次）后落库，返回实际入库条数 */
  private async storeCleanComments(
    raws: Array<{
      sourceRef: string;
      content: string;
      authorId?: string;
      likes?: number;
      collectedAt?: Date;
    }>,
    tenantId: string,
    task: CollectTaskEntity,
  ): Promise<CollectedCommentEntity[]> {
    const stored: CollectedCommentEntity[] = [];
    const seen = new Set<string>();
    for (const raw of raws) {
      const { cleaned, isClean, cleanResult } = this.analyzeComment(raw.content);
      const contentHash = this.hashContent(`${raw.sourceRef}|${cleaned}`);
      if (seen.has(contentHash)) continue; // 批内去重
      seen.add(contentHash);
      const dup = await this.commentRepo.findOne({ where: { tenantId, contentHash } }); // 跨批次去重
      if (dup) continue;

      const entity = this.commentRepo.create({
        tenantId,
        platform: task.platform,
        sourceType: CollectSourceType.Comment,
        sourceRef: raw.sourceRef,
        content: cleaned, // 已剥离隐私
        authorId: raw.authorId, // 仅平台公开 ID（字段白名单）
        likes: raw.likes ?? 0,
        isClean,
        cleanResult,
        contentHash,
        collectedAt: raw.collectedAt ?? new Date(),
        taskId: String(task.id),
      });
      stored.push(await this.commentRepo.save(entity));
    }
    return stored;
  }
}
