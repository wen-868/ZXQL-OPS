import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { createHash } from 'crypto';
import { AppError } from '../../shared/app-error';
import { buildPage, pageOffset } from '../../shared/pagination';
import { TenantContext } from '../../tenant/tenant-context';
import { RedisService } from '../../cache/redis.service';
import { checkUrl } from '../../shared/url-guard';
import { CollectRateLimiter } from './rate-limiter';
import { CollectorGateway } from './collector/collector.gateway';
import {
  CleaningOptions,
  CollectControlAction,
  CollectSourceType,
  CollectTaskStatus,
  CollectTaskType,
  CommentReviewStatus,
  HotType,
} from './intel.types';
import { CompetitorEntity } from './competitor.entity';
import { CollectedCommentEntity } from './collected-comment.entity';
import { CollectTaskEntity } from './collect-task.entity';
import { CollectSourceEntity } from './collect-source.entity';
import { HotSnapshotEntity } from './hot-snapshot.entity';
import { CreateCompetitorDto } from './dto/create-competitor.dto';
import { UpdateCompetitorDto } from './dto/update-competitor.dto';
import { CreateCollectTaskDto } from './dto/create-collect-task.dto';
import { CollectedCommentQueryDto } from './dto/collected-comment-query.dto';
import { KeywordMineDto } from './dto/keyword-mine.dto';
import { CreateCollectSourceDto, UpdateCollectSourceDto } from './dto/collect-source.dto';

/** 热点榜单读缓存 TTL（秒）：Redis 兜底 60s，缓解高频读库 */
const HOT_LIST_CACHE_TTL = 60;

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

/** 上游采集原始条目（清洗前的字段白名单子集） */
type RawCommentLike = {
  sourceRef: string;
  content: string;
  authorId?: string;
  likes?: number;
  collectedAt?: Date;
};

/** 默认清洗开关（全开：去重 / PII 剥离 / 广告过滤；自动通过不送审） */
const DEFAULT_CLEANING: Required<CleaningOptions> = {
  dedup: true,
  piiStrip: true,
  adFilter: true,
  reviewRequired: false,
};

/**
 * 情报采集服务（规划 §4-C，增强：真实可控）。
 * 职责：竞品 CRUD + 监控开关、采集源配置（公开网页抓取/本地样本）、采集任务异步调度 +
 * 任务生命周期控制（暂停/恢复/取消/重试）、评论清洗去重（可配置开关）、
 * 结果审核（pending/approved/rejected，D 只消费 approved）、字段白名单合规审计、
 * 令牌桶限频（按源配置 rate_limit）、热点追踪、关键词挖掘。
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
    @InjectRepository(CollectSourceEntity)
    private readonly sourceRepo: Repository<CollectSourceEntity>,
    @InjectRepository(HotSnapshotEntity)
    private readonly hotRepo: Repository<HotSnapshotEntity>,
    private readonly rateLimiter: CollectRateLimiter,
    private readonly collectorGateway: CollectorGateway,
    private readonly redis: RedisService,
  ) {}

  // —— 采集源配置 ——

  async createSource(dto: CreateCollectSourceDto): Promise<CollectSourceEntity> {
    const tenantId = TenantContext.requireTenantId();
    // SSRF 防护：源 target 会被 cron 周期反复抓取，落库前即校验
    await this.assertTargetSafe(dto.target);
    const source = this.sourceRepo.create({
      tenantId,
      name: dto.name,
      platform: dto.platform,
      sourceType: dto.sourceType,
      target: dto.target,
      mode: dto.mode,
      rateLimit: dto.rateLimit,
      cleaning: { ...DEFAULT_CLEANING, ...(dto.cleaning ?? {}) },
      config: dto.config ?? {},
      enabled: true,
      collectCount: 0,
    });
    return this.sourceRepo.save(source);
  }

  async listSources(): Promise<CollectSourceEntity[]> {
    const tenantId = TenantContext.requireTenantId();
    return this.sourceRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  /** 采集源可直赋字段清单（dto 键与实体键同名） */
  private static readonly SOURCE_FIELDS: Array<keyof UpdateCollectSourceDto> = [
    'name',
    'platform',
    'sourceType',
    'target',
    'mode',
    'rateLimit',
    'config',
    'enabled',
  ];

  async updateSource(id: number, dto: UpdateCollectSourceDto): Promise<CollectSourceEntity> {
    const tenantId = TenantContext.requireTenantId();
    const source = await this.sourceRepo.findOne({ where: { id, tenantId } });
    if (!source) throw new AppError('COLLECT_SOURCE_NOT_FOUND');
    if (dto.target !== undefined) await this.assertTargetSafe(dto.target);

    const target = source as unknown as Record<string, unknown>;
    for (const field of IntelService.SOURCE_FIELDS) {
      if (dto[field] !== undefined) target[field] = dto[field];
    }
    // 清洗开关需与默认值合并（非直接覆盖）
    if (dto.cleaning !== undefined) source.cleaning = { ...DEFAULT_CLEANING, ...dto.cleaning };
    return this.sourceRepo.save(source);
  }

  async removeSource(id: number): Promise<{ id: number }> {
    const tenantId = TenantContext.requireTenantId();
    const source = await this.sourceRepo.findOne({ where: { id, tenantId } });
    if (!source) throw new AppError('COLLECT_SOURCE_NOT_FOUND');
    await this.sourceRepo.softDelete({ id, tenantId });
    return { id };
  }

  /**
   * 采集目标 SSRF 校验：仅当 target 为绝对 URL 时才校验（关键词由平台搜索模板拼装，
   * 目标域名固定，不受用户控制）。异步版含 DNS 解析，防域名指向内网 / DNS rebinding。
   */
  private async assertTargetSafe(target: string): Promise<void> {
    const t = (target ?? '').trim();
    if (!/^https?:\/\//i.test(t)) return; // 非 URL（关键词）跳过
    if (t.length > 512) throw new AppError('COLLECT_TARGET_BLOCKED', '采集目标过长');
    const guarded = await checkUrl(t);
    if (!guarded.ok) {
      throw new AppError('COLLECT_TARGET_BLOCKED', guarded.reason);
    }
  }

  /** 由采集源发起采集：继承源配置（target/platform/rateLimit/cleaning/config），并回填 task.source_id */
  async collectFromSource(sourceId: number): Promise<{ taskId: number; traceId: string }> {
    const tenantId = TenantContext.requireTenantId();
    const source = await this.sourceRepo.findOne({ where: { id: sourceId, tenantId } });
    if (!source) throw new AppError('COLLECT_SOURCE_NOT_FOUND');
    if (!source.enabled) throw new AppError('COLLECT_SOURCE_DISABLED');
    return this.createCollectTask(
      {
        type: (source.sourceType === 'hot'
          ? 'hot'
          : source.sourceType === 'keyword'
            ? 'keyword'
            : 'comment') as CollectTaskType,
        target: source.target,
        platform: source.platform,
        sourceLevel: 'L2',
        sourceId: source.id,
        cleaning: source.cleaning,
      },
      source,
    );
  }

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

  // —— 采集任务（异步 + 生命周期控制） ——

  /**
   * 发起采集任务：限频（令牌桶，按源 rate_limit）→ 校验来源级别 → 落 pending。
   * 由 @Cron processPendingTasks 异步处理。返回 { taskId, traceId }。
   */
  async createCollectTask(
    dto: CreateCollectTaskDto,
    source?: CollectSourceEntity,
  ): Promise<{ taskId: number; traceId: string }> {
    const tenantId = TenantContext.requireTenantId();
    await this.assertCollectAllowed(tenantId, dto, source);
    const saved = await this.taskRepo.save(this.buildCollectTask(tenantId, dto, source));
    return { taskId: saved.id, traceId: TenantContext.getTraceId() ?? '' };
  }

  /** 发起前置门禁：令牌桶限频 → 来源级别 → 目标 SSRF */
  private async assertCollectAllowed(
    tenantId: string,
    dto: CreateCollectTaskDto,
    source?: CollectSourceEntity,
  ): Promise<void> {
    const capacity = source?.rateLimit ?? RATE_CAPACITY;
    const allowed = await this.rateLimiter.allow(tenantId, dto.platform, capacity, capacity / 60);
    if (!allowed) throw new AppError('COLLECT_RATE_LIMITED');
    if (dto.sourceLevel !== 'L1' && dto.sourceLevel !== 'L2') {
      throw new AppError('COLLECT_SOURCE_LEVEL_INVALID');
    }
    // SSRF 防护：采集 target 若为绝对 URL，服务端会代表用户发起请求，
    // 须先拦截内网/元数据地址，否则可借采集功能探测内网。
    await this.assertTargetSafe(dto.target);
  }

  /** 清洗开关解析：任务级覆盖 > 源级继承 > 系统默认 */
  private static resolveCleaning(
    dto: CreateCollectTaskDto,
    source?: CollectSourceEntity,
  ): CleaningOptions {
    return { ...DEFAULT_CLEANING, ...(dto.cleaning ?? source?.cleaning ?? {}) };
  }

  /** 采集任务实体构造（任务级覆盖 > 源级继承 > 系统默认） */
  private buildCollectTask(
    tenantId: string,
    dto: CreateCollectTaskDto,
    source?: CollectSourceEntity,
  ): CollectTaskEntity {
    return this.taskRepo.create({
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
      sourceId: dto.sourceId ?? source?.id,
      cleaning: IntelService.resolveCleaning(dto, source),
      config: source?.config,
    });
  }

  async getCollectTask(id: number): Promise<CollectTaskEntity> {
    const tenantId = TenantContext.requireTenantId();
    const task = await this.taskRepo.findOne({ where: { id, tenantId } });
    if (!task) throw new AppError('COLLECT_TASK_NOT_FOUND');
    return task;
  }

  async listCollectTasks(
    page = 1,
    pageSize = 20,
  ): Promise<{
    list: CollectTaskEntity[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const tenantId = TenantContext.requireTenantId();
    const { skip, take } = pageOffset(page, pageSize);
    const [rows, total] = await this.taskRepo.findAndCount({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      skip,
      take,
    });
    return buildPage(rows, total, page, pageSize);
  }

  /**
   * 任务生命周期控制转移表：动作 →（允许的源状态 + 应用函数）。
   * 数据驱动替代 switch+if，controlCollectTask 圈复杂度 12 → ~4。
   */
  private static readonly CONTROL_RULES: Record<
    CollectControlAction,
    { from: CollectTaskStatus[]; msg: string; apply: (task: CollectTaskEntity) => void }
  > = {
    pause: {
      from: [CollectTaskStatus.Pending, CollectTaskStatus.Running],
      msg: '仅排队中/采集中可暂停',
      apply: (t) => {
        t.status = CollectTaskStatus.Paused;
        t.pausedAt = new Date();
      },
    },
    resume: {
      from: [CollectTaskStatus.Paused],
      msg: '仅已暂停任务可恢复',
      apply: (t) => {
        t.status = CollectTaskStatus.Pending;
        t.pausedAt = undefined;
      },
    },
    cancel: {
      from: [CollectTaskStatus.Pending, CollectTaskStatus.Running, CollectTaskStatus.Paused],
      msg: '仅排队中/采集中/已暂停可取消',
      apply: (t) => {
        t.status = CollectTaskStatus.Cancelled;
        t.finishedAt = new Date();
      },
    },
    retry: {
      from: [CollectTaskStatus.Failed, CollectTaskStatus.Cancelled],
      msg: '仅失败/已取消任务可重试',
      apply: (t) => {
        t.status = CollectTaskStatus.Pending;
        t.retryCount += 1;
        t.errorMsg = undefined;
        t.finishedAt = undefined;
      },
    },
  };

  /**
   * 任务生命周期控制：pause / resume / cancel / retry（见 CONTROL_RULES 转移表）。
   */
  async controlCollectTask(id: number, action: CollectControlAction): Promise<CollectTaskEntity> {
    const tenantId = TenantContext.requireTenantId();
    const task = await this.taskRepo.findOne({ where: { id, tenantId } });
    if (!task) throw new AppError('COLLECT_TASK_NOT_FOUND');

    const rule = IntelService.CONTROL_RULES[action];
    if (!rule || !rule.from.includes(task.status)) {
      throw new AppError('COLLECT_TASK_STATE_INVALID', rule?.msg ?? '不支持的操作');
    }
    rule.apply(task);
    return this.taskRepo.save(task);
  }

  /** 任务关联的采集源（不存在/查询失败返回 null） */
  private async findTaskSource(task: CollectTaskEntity): Promise<CollectSourceEntity | null> {
    if (!task.sourceId) return null;
    return this.sourceRepo
      .findOne({ where: { id: task.sourceId, tenantId: task.tenantId } })
      .catch(() => null);
  }

  /** 标记任务完成（done）并回填采集源成功信息 */
  private async markTaskDone(task: CollectTaskEntity, storedCount: number): Promise<void> {
    task.collectedCount = storedCount;
    task.progress = 100;
    task.status = CollectTaskStatus.Done;
    task.finishedAt = new Date();
    await this.taskRepo.save(task);
    const source = await this.findTaskSource(task);
    if (!source) return;
    source.lastCollectedAt = new Date();
    source.collectCount += storedCount;
    source.errorMsg = undefined;
    await this.sourceRepo.save(source).catch(() => undefined);
  }

  /** 标记任务失败（failed）并回填采集源错误信息 */
  private async markTaskFailed(task: CollectTaskEntity, err: unknown): Promise<void> {
    const message = (err as Error).message;
    task.status = CollectTaskStatus.Failed;
    task.errorMsg = message;
    task.finishedAt = new Date();
    await this.taskRepo.save(task).catch(() => undefined);
    const source = await this.findTaskSource(task);
    if (!source) return;
    source.errorMsg = message;
    await this.sourceRepo.save(source).catch(() => undefined);
  }

  /** 单任务执行：取数 →（未取消则）清洗落库 → done；异常走 failed */
  private async runOneTask(task: CollectTaskEntity): Promise<void> {
    task.status = CollectTaskStatus.Running;
    task.progress = 10;
    await this.taskRepo.save(task);
    try {
      const adapter = this.collectorGateway.resolve(task.platform);
      const raws = await adapter.fetchComments(task);
      // 取数期间被取消：弃结果，不落库
      const fresh = await this.taskRepo.findOne({ where: { id: task.id } });
      if (fresh?.status === CollectTaskStatus.Cancelled) {
        return;
      }
      const stored = await this.storeCleanComments(raws, task.tenantId, task);
      await this.markTaskDone(task, stored.length);
    } catch (err) {
      await this.markTaskFailed(task, err);
    }
  }

  /**
   * 异步工作器（每 5 秒）：处理 pending 任务 → running → done/failed。
   * 跳过 paused/cancelled；running 中被 cancel 的任务在取数后复查，弃结果不落库。
   * 清洗按任务 cleaning 开关执行；reviewRequired 时落库 review_status=pending（送人工审核）。
   */
  @Cron(CronExpression.EVERY_5_SECONDS)
  async processPendingTasks(): Promise<void> {
    const pending = await this.taskRepo.find({
      where: { status: CollectTaskStatus.Pending },
      take: 10,
    });
    for (const task of pending) {
      await this.runOneTask(task);
    }
  }

  // —— 供 D 消费：干净评论分页（含审核状态过滤） ——

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
    if (query.reviewStatus) {
      qb.andWhere('c.review_status = :reviewStatus', { reviewStatus: query.reviewStatus });
    }
    if (query.platform) {
      qb.andWhere('c.platform = :platform', { platform: query.platform });
    }
    qb.orderBy('c.collected_at', 'DESC').skip(skip).take(take);

    const [rows, total] = await qb.getManyAndCount();
    return buildPage(rows, total, query.page ?? 1, query.pageSize ?? 20);
  }

  // —— 评论审核 ——

  async reviewComment(id: number, status: CommentReviewStatus): Promise<CollectedCommentEntity> {
    const tenantId = TenantContext.requireTenantId();
    const comment = await this.commentRepo.findOne({ where: { id, tenantId } });
    if (!comment) throw new AppError('COMMENT_NOT_FOUND');
    if (!Object.values(CommentReviewStatus).includes(status)) {
      throw new AppError('COMMENT_REVIEW_INVALID');
    }
    comment.reviewStatus = status;
    return this.commentRepo.save(comment);
  }

  async reviewCommentsBatch(
    ids: number[],
    status: CommentReviewStatus,
  ): Promise<{ updated: number }> {
    const tenantId = TenantContext.requireTenantId();
    if (!Object.values(CommentReviewStatus).includes(status)) {
      throw new AppError('COMMENT_REVIEW_INVALID');
    }
    if (!ids.length) return { updated: 0 };
    const result = await this.commentRepo.update(
      { id: In(ids), tenantId },
      { reviewStatus: status },
    );
    return { updated: result.affected ?? 0 };
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
      // 采集后失效榜单缓存，下次读库重新回填
      await this.redis.del(`intel:hot:${tenantId}:${type}`).catch(() => undefined);
    } else {
      // 读缓存（60s），Redis 不可用降级直读 DB
      const cacheKey = `intel:hot:${tenantId}:${type}`;
      try {
        const cached = await this.redis.getJson<Array<Partial<HotSnapshotEntity>>>(cacheKey);
        if (Array.isArray(cached) && cached.length > 0) {
          return cached as HotSnapshotEntity[];
        }
      } catch {
        // Redis 异常：降级直读 DB，不阻塞业务
      }
      const rows = await this.hotRepo.find({
        where: { tenantId },
        order: { capturedAt: 'DESC' },
        take: 50,
      });
      if (rows.length > 0) {
        await this.redis.setJson(cacheKey, rows, HOT_LIST_CACHE_TTL).catch(() => undefined);
      }
      return rows;
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
   * 返回清洗后内容与清洗结果（供审计）。开关：piiStrip / adFilter。
   */
  private analyzeComment(
    content: string,
    cleaning: CleaningOptions,
  ): {
    cleaned: string;
    isClean: boolean;
    cleanResult: Record<string, unknown>;
  } {
    let cleaned = content;
    const piiRemoved: string[] = [];
    if (cleaning.piiStrip !== false) {
      for (const [name, re] of PII_PATTERNS) {
        re.lastIndex = 0; // /g 正则复用必须重置 lastIndex，防止跨评论漏剥
        if (re.test(content)) {
          re.lastIndex = 0;
          cleaned = cleaned.replace(re, '[已脱敏]');
          piiRemoved.push(name);
        }
      }
    }
    const ad =
      cleaning.adFilter !== false &&
      AD_KEYWORDS.some((k) => content.toLowerCase().includes(k.toLowerCase()));
    const isClean = piiRemoved.length === 0 && !ad;
    return { cleaned, isClean, cleanResult: { piiRemoved, ad } };
  }

  private hashContent(s: string): string {
    return createHash('sha1').update(s).digest('hex');
  }

  /** 去重判定（仅 dedup 开启时）：批内已见 或 库中已存在同哈希 → 跳过 */
  private async isDuplicate(
    cleaning: CleaningOptions,
    seen: Set<string>,
    contentHash: string,
    tenantId: string,
  ): Promise<boolean> {
    if (cleaning.dedup === false) return false;
    if (seen.has(contentHash)) return true; // 批内去重
    seen.add(contentHash);
    const dup = await this.commentRepo.findOne({ where: { tenantId, contentHash } }); // 跨批次去重
    return !!dup;
  }

  /** 落库实体构造（字段白名单 + 审核状态 + ?? 缺省集中于此） */
  private buildCommentEntity(
    raw: RawCommentLike,
    tenantId: string,
    task: CollectTaskEntity,
    cleaning: CleaningOptions,
    cleaned: string,
    isClean: boolean,
    cleanResult: Record<string, unknown>,
    contentHash: string,
  ): CollectedCommentEntity {
    return this.commentRepo.create({
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
      reviewStatus: cleaning.reviewRequired
        ? CommentReviewStatus.Pending
        : CommentReviewStatus.Approved,
      collectedAt: raw.collectedAt ?? new Date(),
      taskId: String(task.id),
    });
  }

  /** 清洗 + 去重（批内 + 跨批次，按任务开关）+ 审核状态后落库，返回实际入库条数 */
  private async storeCleanComments(
    raws: RawCommentLike[],
    tenantId: string,
    task: CollectTaskEntity,
  ): Promise<CollectedCommentEntity[]> {
    const stored: CollectedCommentEntity[] = [];
    const cleaning = task.cleaning ?? DEFAULT_CLEANING;
    const seen = new Set<string>();
    for (const raw of raws) {
      const { cleaned, isClean, cleanResult } = this.analyzeComment(raw.content, cleaning);
      const contentHash = this.hashContent(`${raw.sourceRef}|${cleaned}`);
      if (await this.isDuplicate(cleaning, seen, contentHash, tenantId)) continue;
      stored.push(
        await this.commentRepo.save(
          this.buildCommentEntity(
            raw,
            tenantId,
            task,
            cleaning,
            cleaned,
            isClean,
            cleanResult,
            contentHash,
          ),
        ),
      );
    }
    return stored;
  }
}
