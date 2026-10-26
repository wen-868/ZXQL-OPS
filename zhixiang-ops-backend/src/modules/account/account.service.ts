import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, QueryFailedError, Repository } from 'typeorm';
import { AppError } from '../../shared/app-error';
import { buildPage, pageOffset } from '../../shared/pagination';
import { encryptSecret } from '../../shared/crypto';
import { TenantContext } from '../../tenant/tenant-context';
import { AccountHealthEventType, AccountStatus } from './account.types';
import { computeHealthScore, scoreBaseByStatus } from './account-score';
import { AccountEntity } from './account.entity';
import { AccountGroupEntity } from './account-group.entity';
import { AccountHealthEventEntity } from './account-health-event.entity';
import { AccountEnvEntity } from './account-env.entity';
import { AccountRiskLogEntity } from './account-risk-log.entity';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { AccountQueryDto } from './dto/account-query.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ConfigureAccountEnvDto } from './dto/configure-account-env.dto';
import { CreateAccountGroupDto } from './dto/create-account-group.dto';

/** Token 临近过期提前告警窗口（天） */
const WARN_BEFORE_DAYS = 3;

/** 健康分（0-100）规则：状态基准分 - 近 30 天关联风险日志条数 × 5（下限 0） */
const RISK_SCORE_DEDUCT = 5;
const RISK_SCORE_WINDOW_DAYS = 30;

/**
 * 账号矩阵服务（规划 §4-B / B-core）。
 * 职责：账号 CRUD、分组筛选、矩阵健康看板、Token 续期、定时健康巡检（掉签/临期）。
 * 全部按 tenantId 隔离（TenantContext.requireTenantId + 显式 where）。
 */
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    @InjectRepository(AccountEntity)
    private readonly accountRepo: Repository<AccountEntity>,
    @InjectRepository(AccountHealthEventEntity)
    private readonly eventRepo: Repository<AccountHealthEventEntity>,
    @InjectRepository(AccountEnvEntity)
    private readonly envRepo: Repository<AccountEnvEntity>,
    @InjectRepository(AccountRiskLogEntity)
    private readonly riskRepo: Repository<AccountRiskLogEntity>,
    @InjectRepository(AccountGroupEntity)
    private readonly groupRepo: Repository<AccountGroupEntity>,
  ) {}

  /** 创建账号；Token 明文入参 → 加密存储；重复 (tenant,platform,platformAccountId) 抛 ACCOUNT_DUPLICATE */
  async create(dto: CreateAccountDto): Promise<AccountEntity> {
    const tenantId = TenantContext.requireTenantId();
    const account = this.accountRepo.create({
      tenantId,
      platform: dto.platform as AccountEntity['platform'],
      platformAccountId: dto.platformAccountId,
      nickname: dto.nickname,
      avatarUrl: dto.avatarUrl,
      identity: (dto.identity as AccountEntity['identity']) ?? 'matrix',
      track: dto.track,
      stage: (dto.stage as AccountEntity['stage']) ?? 'nurturing',
      fansCount: 0,
      followCount: 0,
      likeCount: 0,
      ...AccountService.numericFields(dto),
      remark: dto.remark,
    });

    this.applyTokenBinding(account, dto);
    account.healthScore = scoreBaseByStatus(account.status);

    const saved = await this.saveOrDuplicate(account);
    if (dto.accessToken) {
      await this.logEvent(saved, 'connected', 'unsigned', saved.status, '首次绑定 Token');
    }
    return this.toView(saved);
  }

  private static readonly COUNT_FIELDS = ['fansCount', 'followCount', 'likeCount'] as const;

  /** 计数字段：仅 dto 显式提供时覆盖默认 0 */
  private static numericFields(dto: CreateAccountDto): Record<string, number> {
    const out: Record<string, number> = {};
    for (const key of AccountService.COUNT_FIELDS) {
      const value = dto[key];
      if (value !== undefined) out[key] = value;
    }
    return out;
  }

  /** 绑定 Token：加密落字段 + 推导初始状态；无 Token → unsigned */
  private applyTokenBinding(account: AccountEntity, dto: CreateAccountDto): void {
    if (!dto.accessToken) {
      account.status = 'unsigned';
      return;
    }
    account.tokenEnc = encryptSecret(dto.accessToken);
    if (dto.refreshToken) account.refreshTokenEnc = encryptSecret(dto.refreshToken);
    account.tokenExpireAt = dto.tokenExpireAt ? new Date(dto.tokenExpireAt) : undefined;
    account.status = this.deriveStatusByToken(account.tokenExpireAt, 'unsigned');
  }

  /** 保存并把唯一键冲突翻译为 ACCOUNT_DUPLICATE */
  private async saveOrDuplicate(account: AccountEntity): Promise<AccountEntity> {
    try {
      return await this.accountRepo.save(account);
    } catch (err) {
      if (err instanceof QueryFailedError && this.isDuplicate(err)) {
        throw new AppError('ACCOUNT_DUPLICATE');
      }
      throw err;
    }
  }

  /** 列表：分组筛选 + 分页；返回标准化 {list,total,page,pageSize} */
  async findAll(query: AccountQueryDto): Promise<{
    list: AccountEntity[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const tenantId = TenantContext.requireTenantId();
    const { skip, take } = pageOffset(query.page, query.pageSize);

    const qb = this.accountRepo
      .createQueryBuilder('a')
      .where('a.tenant_id = :tenantId', { tenantId });
    AccountService.applyFilters(qb, query);
    qb.orderBy('a.created_at', 'DESC').skip(skip).take(take);

    const [rows, total] = await qb.getManyAndCount();
    return buildPage(
      rows.map((r) => this.toView(r)),
      total,
      query.page ?? 1,
      query.pageSize ?? 20,
    );
  }

  /** 列表筛选条件清单（精确匹配列 → 查询字段；空值跳过） */
  private static readonly QUERY_EQ_FIELDS: Array<[keyof AccountQueryDto, string]> = [
    ['platform', 'platform'],
    ['identity', 'identity'],
    ['stage', 'stage'],
    ['status', 'status'],
    ['track', 'track'],
  ];

  /** 逐项追加筛选条件（keyword 走昵称模糊匹配） */
  private static applyFilters(
    qb: ReturnType<Repository<AccountEntity>['createQueryBuilder']>,
    query: AccountQueryDto,
  ): void {
    for (const [dtoKey, column] of AccountService.QUERY_EQ_FIELDS) {
      const value = query[dtoKey];
      if (value) qb.andWhere(`a.${column} = :${column}`, { [column]: value });
    }
    if (query.keyword) {
      qb.andWhere('a.nickname LIKE :kw', { kw: `%${query.keyword}%` });
    }
  }

  /** 详情（按 tenant 隔离） */
  async findOne(id: number): Promise<AccountEntity> {
    const tenantId = TenantContext.requireTenantId();
    const account = await this.accountRepo.findOne({ where: { id, tenantId } });
    if (!account) throw new AppError('ACCOUNT_NOT_FOUND');
    return this.toView(account);
  }

  /** 局部更新；Token 字段若传入则重新加密；状态可由事件驱动 */
  async update(id: number, dto: UpdateAccountDto): Promise<AccountEntity> {
    const tenantId = TenantContext.requireTenantId();
    const account = await this.accountRepo.findOne({ where: { id, tenantId } });
    if (!account) throw new AppError('ACCOUNT_NOT_FOUND');

    const prevStatus = account.status;
    // 需类型转换的枚举字段显式赋值
    if (dto.platform) account.platform = dto.platform as AccountEntity['platform'];
    if (dto.identity) account.identity = dto.identity as AccountEntity['identity'];
    if (dto.stage) account.stage = dto.stage as AccountEntity['stage'];
    if (dto.status) account.status = dto.status as AccountStatus;
    this.applyScalarFields(account, dto);
    await this.applyGroupField(account, dto, tenantId);
    this.applyTokenFields(account, dto);

    await this.syncHealthScore(account);
    const saved = await this.accountRepo.save(account);
    if (prevStatus !== saved.status) {
      await this.logEvent(saved, 'recovered', prevStatus, saved.status, '状态变更');
    }
    return this.toView(saved);
  }

  /** 可直赋标量字段批量写入（数据驱动，避免逐字段 if 堆叠） */
  private applyScalarFields(account: AccountEntity, dto: UpdateAccountDto): void {
    const scalars: Array<[keyof UpdateAccountDto, keyof AccountEntity]> = [
      ['platformAccountId', 'platformAccountId'],
      ['nickname', 'nickname'],
      ['avatarUrl', 'avatarUrl'],
      ['track', 'track'],
      ['fansCount', 'fansCount'],
      ['followCount', 'followCount'],
      ['likeCount', 'likeCount'],
      ['remark', 'remark'],
      ['persona', 'persona'],
    ];
    for (const [dtoKey, entityKey] of scalars) {
      const value = dto[dtoKey];
      if (value !== undefined) {
        (account as unknown as Record<string, unknown>)[entityKey] = value;
      }
    }
    if (dto.lastActiveAt) account.lastActiveAt = new Date(dto.lastActiveAt);
  }

  /** 分组变更：目标分组需存在（租户内校验） */
  private async applyGroupField(
    account: AccountEntity,
    dto: UpdateAccountDto,
    tenantId: string,
  ): Promise<void> {
    if (!('groupId' in dto)) return;
    if (dto.groupId != null) {
      const group = await this.groupRepo.findOne({ where: { id: dto.groupId, tenantId } });
      if (!group) throw new AppError('ACCOUNT_GROUP_NOT_FOUND');
    }
    account.groupId = dto.groupId ?? null;
  }

  /** Token 更新：重新加密 + 刷新有效期 + 按新有效期派生状态 */
  private applyTokenFields(account: AccountEntity, dto: UpdateAccountDto): void {
    if (!dto.accessToken) return;
    account.tokenEnc = encryptSecret(dto.accessToken);
    if (dto.refreshToken) account.refreshTokenEnc = encryptSecret(dto.refreshToken);
    account.tokenExpireAt = dto.tokenExpireAt ? new Date(dto.tokenExpireAt) : account.tokenExpireAt;
    if (!dto.status) {
      account.status = this.deriveStatusByToken(account.tokenExpireAt, account.status);
    }
  }

  /** 软删除（BaseEntity + DeleteDateColumn） */
  async remove(id: number): Promise<{ id: number }> {
    const tenantId = TenantContext.requireTenantId();
    const account = await this.accountRepo.findOne({ where: { id, tenantId } });
    if (!account) throw new AppError('ACCOUNT_NOT_FOUND');
    await this.accountRepo.softDelete({ id, tenantId });
    return { id };
  }

  /** 续期 / 重新授权：提交新 Token，清除掉签风险 */
  async refreshToken(id: number, dto: RefreshTokenDto): Promise<AccountEntity> {
    const tenantId = TenantContext.requireTenantId();
    const account = await this.accountRepo.findOne({ where: { id, tenantId } });
    if (!account) throw new AppError('ACCOUNT_NOT_FOUND');

    const prevStatus = account.status;
    account.tokenEnc = encryptSecret(dto.accessToken);
    if (dto.refreshToken) account.refreshTokenEnc = encryptSecret(dto.refreshToken);
    account.tokenExpireAt = dto.tokenExpireAt ? new Date(dto.tokenExpireAt) : undefined;
    account.status = this.deriveStatusByToken(account.tokenExpireAt, 'normal');

    await this.syncHealthScore(account);
    const saved = await this.accountRepo.save(account);
    await this.logEvent(saved, 'token_refreshed', prevStatus, saved.status, 'Token 续期成功');
    return this.toView(saved);
  }

  /** 矩阵健康看板：按状态 / 平台聚合计数 */
  async healthSummary(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byPlatform: Record<string, number>;
    unsignedAccounts: Array<{ id: number; nickname?: string; platform: string }>;
  }> {
    const tenantId = TenantContext.requireTenantId();
    const rows = await this.accountRepo.find({ where: { tenantId } });

    const byStatus: Record<string, number> = {};
    const byPlatform: Record<string, number> = {};
    const unsignedAccounts: Array<{ id: number; nickname?: string; platform: string }> = [];

    for (const r of rows) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      byPlatform[r.platform] = (byPlatform[r.platform] ?? 0) + 1;
      if (r.status === 'unsigned') {
        unsignedAccounts.push({ id: r.id, nickname: r.nickname, platform: r.platform });
      }
    }
    return { total: rows.length, byStatus, byPlatform, unsignedAccounts };
  }

  // —— B-advanced：账号分组 / 矩阵视图（§4-B / B-advanced）——

  /** 创建账号分组；同租户重名抛 ACCOUNT_GROUP_DUPLICATE */
  async createGroup(dto: CreateAccountGroupDto): Promise<AccountGroupEntity> {
    const tenantId = TenantContext.requireTenantId();
    try {
      const group = this.groupRepo.create({
        tenantId,
        name: dto.name,
        platform: dto.platform as AccountGroupEntity['platform'],
        sortOrder: dto.sortOrder ?? 0,
        description: dto.description,
      });
      return await this.groupRepo.save(group);
    } catch (err) {
      if (err instanceof QueryFailedError && this.isDuplicate(err)) {
        throw new AppError('ACCOUNT_GROUP_DUPLICATE');
      }
      throw err;
    }
  }

  /** 分组列表：附各组账号数，按 sortOrder 升序 */
  async listGroups(): Promise<{
    list: Array<{
      id: number;
      name: string;
      platform?: string;
      sortOrder: number;
      description?: string;
      accountCount: number;
    }>;
    total: number;
  }> {
    const tenantId = TenantContext.requireTenantId();
    const groups = await this.groupRepo.find({
      where: { tenantId },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    const accounts = await this.accountRepo.find({ where: { tenantId } });
    const counts = new Map<number, number>();
    for (const a of accounts) {
      if (a.groupId == null) continue;
      counts.set(a.groupId, (counts.get(a.groupId) ?? 0) + 1);
    }
    const list = groups.map((g) => ({
      id: g.id,
      name: g.name,
      platform: g.platform,
      sortOrder: g.sortOrder,
      description: g.description,
      accountCount: counts.get(g.id) ?? 0,
    }));
    return { list, total: list.length };
  }

  /** 组内账号列表（含健康分，剥离敏感字段） */
  async listGroupAccounts(id: number): Promise<AccountEntity[]> {
    const tenantId = TenantContext.requireTenantId();
    const group = await this.groupRepo.findOne({ where: { id, tenantId } });
    if (!group) throw new AppError('ACCOUNT_GROUP_NOT_FOUND');
    const accounts = await this.accountRepo.find({ where: { tenantId, groupId: id } });
    return accounts.map((a) => this.withScore(a));
  }

  /** 删除分组（软删）；组内仍有账号 → ACCOUNT_GROUP_IN_USE */
  async removeGroup(id: number): Promise<{ id: number }> {
    const tenantId = TenantContext.requireTenantId();
    const group = await this.groupRepo.findOne({ where: { id, tenantId } });
    if (!group) throw new AppError('ACCOUNT_GROUP_NOT_FOUND');
    const inUse = await this.accountRepo.count({ where: { tenantId, groupId: id } });
    if (inUse > 0) throw new AppError('ACCOUNT_GROUP_IN_USE');
    await this.groupRepo.softDelete({ id, tenantId });
    return { id };
  }

  /**
   * 矩阵视图：按分组归档账号（含健康分），未分组/组已删的账号归入 ungrouped。
   * 供 J/M 与前端矩阵页消费；健康分优先读巡检沉淀值，未沉淀时按状态实时兜底。
   */
  async matrix(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    groups: Array<{
      id: number;
      name: string;
      platform?: string;
      accountCount: number;
      accounts: AccountEntity[];
    }>;
    ungrouped: AccountEntity[];
  }> {
    const tenantId = TenantContext.requireTenantId();
    const [groups, accounts] = await Promise.all([
      this.groupRepo.find({
        where: { tenantId },
        order: { sortOrder: 'ASC', id: 'ASC' },
      }),
      this.accountRepo.find({ where: { tenantId } }),
    ]);

    const byStatus: Record<string, number> = {};
    for (const a of accounts) {
      byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;
    }

    const rows = accounts.map((a) => this.withScore(a));
    const ungrouped: AccountEntity[] = [];
    const groupsOut = groups.map((g) => ({
      id: g.id,
      name: g.name,
      platform: g.platform,
      accountCount: 0,
      accounts: [] as AccountEntity[],
    }));
    const byGroup = new Map<number, (typeof groupsOut)[number]>();
    for (const g of groupsOut) byGroup.set(g.id, g);

    for (const a of rows) {
      if (a.groupId == null) {
        ungrouped.push(a);
        continue;
      }
      const g = byGroup.get(a.groupId);
      if (g) {
        g.accounts.push(a);
        g.accountCount++;
      } else {
        ungrouped.push(a); // 组已删/失效 → 归入未分组
      }
    }
    return { total: accounts.length, byStatus, groups: groupsOut, ungrouped };
  }

  // —— B-advanced：账号环境隔离 / 防关联（§4-B / B-advanced）——

  /** 配置账号环境隔离（指纹/IP/设备）；不存在则新建、存在则更新（upsert） */
  async configureEnv(id: number, dto: ConfigureAccountEnvDto): Promise<AccountEnvEntity> {
    const tenantId = TenantContext.requireTenantId();
    const account = await this.accountRepo.findOne({ where: { id, tenantId } });
    if (!account) throw new AppError('ACCOUNT_NOT_FOUND');

    const data = {
      tenantId,
      accountId: id,
      fingerprint: dto.fingerprint,
      ip: dto.ip,
      device: dto.device,
      envIsolated: dto.envIsolated ?? false,
      isolateProvider: dto.isolateProvider ?? 'none',
    };
    let env = await this.envRepo.findOne({ where: { tenantId, accountId: id } });
    if (env) {
      Object.assign(env, data);
    } else {
      env = this.envRepo.create(data);
    }
    return this.envRepo.save(env);
  }

  /** 矩阵关联风险日志：可按 accountId 过滤，返回标准 {list,total} */
  async getRiskLogs(accountId?: number): Promise<{ list: AccountRiskLogEntity[]; total: number }> {
    const tenantId = TenantContext.requireTenantId();
    const qb = this.riskRepo.createQueryBuilder('r').where('r.tenant_id = :tenantId', { tenantId });
    if (accountId) qb.andWhere('r.account_id = :accountId', { accountId });
    qb.orderBy('r.logged_at', 'DESC');
    const [rows, total] = await qb.getManyAndCount();
    return { list: rows, total };
  }

  /** 矩阵看板增强（风险维度）：隔离数 / 风险数 / 关联对数 / 高风险账号（只读，不写库） */
  async advancedMatrix(): Promise<{
    totalEnvs: number;
    isolatedCount: number;
    riskCount: number;
    associatePairs: number;
    riskAccounts: number[];
  }> {
    const tenantId = TenantContext.requireTenantId();
    const envs = await this.envRepo.find({ where: { tenantId } });
    const riskLogs = await this.riskRepo.find({ where: { tenantId } });
    const { pairs, riskAccounts } = this.computeAssociations(envs);
    return {
      totalEnvs: envs.length,
      isolatedCount: envs.filter((e) => e.envIsolated).length,
      riskCount: riskLogs.length,
      associatePairs: pairs.length,
      riskAccounts,
    };
  }

  /**
   * 防关联封号评估：扫描本租户全部环境配置，找出共享 IP/设备/指纹的账号对，
   * 计算关联度评分（共享 1 项=40，每多 1 项 +30，封顶 100）；高风险(≥60) 写关联风险日志。
   */
  async evaluateAntiAssociate(): Promise<{
    pairs: Array<{ a: number; b: number; shared: string[]; score: number }>;
    riskAccounts: number[];
    evaluatedAt: string;
  }> {
    const tenantId = TenantContext.requireTenantId();
    const envs = await this.envRepo.find({ where: { tenantId } });
    const { pairs, riskAccounts } = this.computeAssociations(envs);

    for (const p of pairs) {
      if (p.score < 60) continue;
      await this.riskRepo.save(
        this.riskRepo.create({
          tenantId,
          accountId: p.a,
          riskType: '关联',
          score: p.score,
          detail: `与账号 ${p.b} 共享 ${p.shared.join('/')}`,
          loggedAt: new Date(),
        }),
      );
      await this.riskRepo.save(
        this.riskRepo.create({
          tenantId,
          accountId: p.b,
          riskType: '关联',
          score: p.score,
          detail: `与账号 ${p.a} 共享 ${p.shared.join('/')}`,
          loggedAt: new Date(),
        }),
      );
    }
    return { pairs, riskAccounts, evaluatedAt: new Date().toISOString() };
  }

  /** 共享维度：IP / 设备 / 指纹（值为空不算共享） */
  private static readonly ENV_DIMENSIONS = ['ip', 'device', 'fingerprint'] as const;

  /** 两个环境配置的共享维度列表（无共享返回空数组） */
  private static sharedDimensions(x: AccountEnvEntity, y: AccountEnvEntity): string[] {
    const shared: string[] = [];
    for (const dim of AccountService.ENV_DIMENSIONS) {
      const v = x[dim];
      if (v && v === y[dim]) shared.push(dim);
    }
    return shared;
  }

  /** 关联度计算（纯函数，不写库）：供 advancedMatrix / evaluateAntiAssociate 复用 */
  private computeAssociations(envs: AccountEnvEntity[]): {
    pairs: Array<{ a: number; b: number; shared: string[]; score: number }>;
    riskAccounts: number[];
  } {
    const pairs: Array<{ a: number; b: number; shared: string[]; score: number }> = [];
    const riskAccounts = new Set<number>();
    for (let i = 0; i < envs.length; i++) {
      for (let j = i + 1; j < envs.length; j++) {
        const x = envs[i];
        const y = envs[j];
        const shared = AccountService.sharedDimensions(x, y);
        if (!shared.length) continue;
        const score = Math.min(100, 40 + (shared.length - 1) * 30);
        pairs.push({ a: x.accountId, b: y.accountId, shared, score });
        if (score >= 60) {
          riskAccounts.add(x.accountId);
          riskAccounts.add(y.accountId);
        }
      }
    }
    return { pairs, riskAccounts: [...riskAccounts] };
  }

  /**
   * 定时健康巡检（每 10 分钟）：
   * - Token 已过期且非 unsigned/banned → 标记 unsigned（掉签）并记事件
   * - Token 临期（≤3 天）且仍为 normal → 标记 warning
   * 跨租户系统任务，tenantId 从账号本身取，事件记录显式赋值。
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async reconcileHealth(): Promise<void> {
    const now = new Date();
    const warnBefore = new Date(now.getTime() + WARN_BEFORE_DAYS * 24 * 3600 * 1000);

    const expired = await this.accountRepo
      .createQueryBuilder('a')
      .where('a.deleted_at IS NULL')
      .andWhere('a.token_expire_at IS NOT NULL')
      .andWhere('a.token_expire_at < :now', { now })
      .andWhere('a.status NOT IN (:...skip)', { skip: ['unsigned', 'banned'] })
      .getMany();
    for (const acc of expired) {
      const prev = acc.status;
      acc.status = 'unsigned';
      await this.syncHealthScore(acc);
      const saved = await this.accountRepo.save(acc);
      await this.logEvent(saved, 'token_expired', prev, 'unsigned', 'Token 过期，自动标记掉签');
    }

    const nearExpiry = await this.accountRepo
      .createQueryBuilder('a')
      .where('a.deleted_at IS NULL')
      .andWhere('a.token_expire_at IS NOT NULL')
      .andWhere('a.token_expire_at BETWEEN :now AND :warn', { now, warn: warnBefore })
      .andWhere('a.status = :normal', { normal: 'normal' })
      .getMany();
    for (const acc of nearExpiry) {
      const prev = acc.status;
      acc.status = 'warning';
      await this.syncHealthScore(acc);
      const saved = await this.accountRepo.save(acc);
      await this.logEvent(saved, 'token_expired', prev, 'warning', 'Token 临期，标记预警');
    }

    if (expired.length || nearExpiry.length) {
      this.logger.log(`健康巡检完成：掉签 ${expired.length} 个，临期预警 ${nearExpiry.length} 个`);
    }
  }

  // —— 内部工具 ——

  /** 由 Token 有效期推导健康状态（无 Token 或已过期 → unsigned） */
  private deriveStatusByToken(expireAt: Date | undefined, fallback: AccountStatus): AccountStatus {
    if (!expireAt) return 'unsigned';
    if (expireAt.getTime() < Date.now()) return 'unsigned';
    return fallback === 'unsigned' ? 'normal' : fallback;
  }

  /** 健康分计算（纯函数）：状态基准分 - 近 30 天风险日志条数 × 5，夹取 0-100 */
  private computeHealthScore(status: AccountStatus, recentRiskCount = 0): number {
    return computeHealthScore(status, recentRiskCount, RISK_SCORE_DEDUCT);
  }

  /** 沉淀健康分到账号行（写内存字段，由调用方 save 落库）；读取失败仅用状态基准分 */
  private async syncHealthScore(account: AccountEntity): Promise<void> {
    if (account.id == null) {
      account.healthScore = scoreBaseByStatus(account.status);
      return;
    }
    const since = new Date(Date.now() - RISK_SCORE_WINDOW_DAYS * 24 * 3600 * 1000);
    let riskCount = 0;
    try {
      const logs = await this.riskRepo.find({
        where: {
          tenantId: account.tenantId,
          accountId: account.id,
          loggedAt: MoreThanOrEqual(since),
        },
      });
      riskCount = logs.length;
    } catch (e) {
      this.logger.warn(`健康分计算读取风险日志失败（按基准分）: ${(e as Error).message}`);
    }
    account.healthScore = this.computeHealthScore(account.status, riskCount);
  }

  /** 视图增强：健康分为空（尚未巡检沉淀）时按状态兜底，并剥离敏感字段 */
  private withScore(account: AccountEntity): AccountEntity {
    if (account.healthScore == null) {
      account.healthScore = scoreBaseByStatus(account.status);
    }
    return this.toView(account);
  }

  private async logEvent(
    account: AccountEntity,
    type: AccountHealthEventType,
    prev: AccountStatus | undefined,
    next: AccountStatus,
    detail?: string,
  ): Promise<void> {
    const event = this.eventRepo.create({
      tenantId: account.tenantId,
      accountId: account.id,
      eventType: type,
      prevStatus: prev,
      nextStatus: next,
      detail,
    });
    await this.eventRepo.save(event).catch((e) => {
      this.logger.warn(`健康事件记录失败（不影响主链路）: ${(e as Error).message}`);
    });
  }

  private isDuplicate(err: unknown): boolean {
    if (!(err instanceof QueryFailedError)) return false;
    const qfe = err as QueryFailedError & { code?: string };
    const msg = String(qfe.message).toLowerCase();
    return msg.includes('duplicate') || qfe.code === 'ER_DUP_ENTRY';
  }

  /** 视图对象：剥离加密 Token，避免敏感凭证外泄 */
  private toView(account: AccountEntity): AccountEntity {
    const { tokenEnc, refreshTokenEnc, ...view } = account;
    void tokenEnc;
    void refreshTokenEnc;
    return view as AccountEntity;
  }
}
