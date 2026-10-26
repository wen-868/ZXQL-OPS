import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, MoreThan, Repository } from 'typeorm';
import { AppError } from '../../shared/app-error';
import { TenantContext } from '../../tenant/tenant-context';
import { ComplianceService } from '../compliance/compliance.service';
import { ProductEntity } from '../r/product.entity';
import { ProductPlatformEntity } from './product-platform.entity';
import { ShelfJobEntity } from './shelf-job.entity';
import { ShelfRuleEntity } from './shelf-rule.entity';
import { SHELF_ADAPTERS } from './shelf.adapters';
import {
  EcommercePlatform,
  ECOMMERCE_PLATFORMS,
  RuleAction,
  ShelfAction,
  ShelfAdapter,
  ShelfStatus,
} from './ecommerce.types';

/** 幂等防抖窗口（同一规则同一动作最近执行过则跳过） */
const IDEMPOTENT_WINDOW_MS = 30 * 60 * 1000;

export interface ShelfRuleInput {
  platform: EcommercePlatform;
  productId: number;
  strategy: 'inventory' | 'time' | 'price' | 'compliance' | 'weight';
  action?: RuleAction;
  params?: Record<string, unknown> | null;
  enabled?: boolean;
  priority?: number;
}

export interface ShelfCycleResult {
  scanned: number;
  executed: number;
  skipped: number;
  jobs: Array<{
    ruleId: number;
    productId: number;
    platform: string;
    action: string;
    status: string;
  }>;
}

/** 策略评估结果 */
interface Decision {
  action: 'up' | 'down' | 'none';
  reason: string;
}

/**
 * 电商自动上下架服务（适配各大平台规则差异）。
 * 核心：规则评估（4 类触发策略）→ 平台适配器执行（各平台差异）→ 落状态与执行记录。
 * 调度：@Cron 每 5 分钟全租户巡检 + 手动触发接口；独立于自动链（deliver 之后由用户按需触发）。
 */
@Injectable()
export class ShelfService implements OnModuleDestroy {
  private readonly logger = new Logger(ShelfService.name);

  constructor(
    @InjectRepository(ShelfRuleEntity)
    private readonly ruleRepo: Repository<ShelfRuleEntity>,
    @InjectRepository(ShelfJobEntity)
    private readonly jobRepo: Repository<ShelfJobEntity>,
    @InjectRepository(ProductPlatformEntity)
    private readonly ppRepo: Repository<ProductPlatformEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    private readonly compliance: ComplianceService,
    private readonly dataSource: DataSource,
  ) {}

  // ============ 规则管理 ============

  /** 流水线发布成功后记录平台商品映射（pending_review 由审核流转自动通过上架） */
  async recordPublication(
    product: { id: number; tenantId: string },
    platform: EcommercePlatform,
    result: { extProductId: string; status: string },
  ): Promise<ProductPlatformEntity> {
    let pp = await this.ppRepo.findOne({
      where: { productId: product.id, platform, tenantId: product.tenantId },
    });
    if (!pp) {
      pp = this.ppRepo.create({
        tenantId: product.tenantId,
        productId: product.id,
        platform,
        shelfStatus: 'unknown',
      });
    }
    pp.shelfStatus = result.status as ProductPlatformEntity['shelfStatus'];
    pp.extShelfId = result.extProductId;
    pp.lastAction = 'publish';
    pp.lastActionAt = new Date();
    return this.ppRepo.save(pp);
  }

  /**
   * 流水线发布原子落库：平台商品映射 + 自动上下架规则 在同一事务内写入（任一失败整体回滚）。
   * 解决多步写无事务的一致性问题（检测项：事务一致性/补偿）。
   */
  async recordPublicationWithRule(
    product: { id: number; tenantId: string },
    platform: EcommercePlatform,
    result: { extProductId: string; status: string },
    ruleInput: Omit<ShelfRuleInput, 'platform' | 'productId'>,
  ): Promise<{ platformRecord: ProductPlatformEntity; rule: ShelfRuleEntity }> {
    if (!ECOMMERCE_PLATFORMS.includes(platform)) {
      throw new AppError('PLATFORM_UNSUPPORTED', `不支持的平台：${platform}`);
    }
    return this.dataSource.transaction(async (em) => {
      const ppRepo = em.getRepository(ProductPlatformEntity);
      let pp = await ppRepo.findOne({
        where: { productId: product.id, platform, tenantId: product.tenantId },
      });
      if (!pp) {
        pp = ppRepo.create({
          tenantId: product.tenantId,
          productId: product.id,
          platform,
          shelfStatus: 'unknown',
        });
      }
      pp.shelfStatus = result.status as ProductPlatformEntity['shelfStatus'];
      pp.extShelfId = result.extProductId;
      pp.lastAction = 'publish';
      pp.lastActionAt = new Date();
      await ppRepo.save(pp);

      const ruleRepo = em.getRepository(ShelfRuleEntity);
      const rule = ruleRepo.create({
        tenantId: product.tenantId,
        productId: product.id,
        platform,
        ...ruleInput,
      });
      const saved = await ruleRepo.save(rule);
      return { platformRecord: pp, rule: saved };
    });
  }

  async createRule(input: ShelfRuleInput): Promise<ShelfRuleEntity> {
    const tenantId = TenantContext.requireTenantId();
    if (!ECOMMERCE_PLATFORMS.includes(input.platform)) {
      throw new AppError('PLATFORM_UNSUPPORTED', `不支持的平台：${input.platform}`);
    }
    const product = await this.productRepo.findOne({
      where: { id: input.productId, tenantId },
    });
    if (!product) throw new AppError('PRODUCT_NOT_FOUND');
    if (!SHELF_ADAPTERS[input.platform]) {
      throw new AppError('PLATFORM_ADAPTER_MISSING', `${input.platform} 适配器未注册`);
    }
    const rule = this.ruleRepo.create({
      tenantId,
      platform: input.platform,
      productId: input.productId,
      strategy: input.strategy,
      action: input.action ?? 'auto',
      params: input.params ?? null,
      enabled: input.enabled ?? true,
      priority: input.priority ?? 0,
      status: 'active',
    });
    return this.ruleRepo.save(rule);
  }

  async listRules(
    filter: { platform?: string; strategy?: string; status?: string } = {},
  ): Promise<ShelfRuleEntity[]> {
    const tenantId = TenantContext.requireTenantId();
    return this.ruleRepo.find({
      where: { tenantId, ...filter } as never,
      order: { priority: 'DESC', id: 'DESC' },
    });
  }

  /** 规则可直赋字段清单（局部更新，undefined 跳过） */
  private static readonly RULE_FIELDS: Array<keyof ShelfRuleInput> = [
    'platform',
    'strategy',
    'action',
    'params',
    'enabled',
    'priority',
    'productId',
  ];

  async updateRule(id: number, input: Partial<ShelfRuleInput>): Promise<ShelfRuleEntity> {
    const tenantId = TenantContext.requireTenantId();
    const rule = await this.ruleRepo.findOne({ where: { id, tenantId } });
    if (!rule) throw new AppError('SHELF_RULE_NOT_FOUND');

    const target = rule as unknown as Record<string, unknown>;
    for (const field of ShelfService.RULE_FIELDS) {
      if (input[field] !== undefined) target[field] = input[field];
    }
    // enabled 联动 status：开→active，关→disabled
    if (input.enabled !== undefined) rule.status = input.enabled ? 'active' : 'disabled';
    return this.ruleRepo.save(rule);
  }

  async removeRule(id: number): Promise<{ deleted: boolean }> {
    const tenantId = TenantContext.requireTenantId();
    const rule = await this.ruleRepo.findOne({ where: { id, tenantId } });
    if (!rule) throw new AppError('SHELF_RULE_NOT_FOUND');
    await this.ruleRepo.softDelete(id);
    return { deleted: true };
  }

  // ============ 执行 ============

  /** 手动触发全量巡检（可限定租户；不限定则扫全部启用规则） */
  async runShelfCycle(tenantId?: string): Promise<ShelfCycleResult> {
    const where: { tenantId?: string; enabled: boolean; status: 'active' } = {
      enabled: true,
      status: 'active' as const,
    };
    if (tenantId) where.tenantId = tenantId;
    const rules = await this.ruleRepo.find({ where, order: { priority: 'DESC', id: 'ASC' } });

    const jobs: ShelfCycleResult['jobs'] = [];
    let executed = 0;
    let skipped = 0;

    for (const rule of rules) {
      const outcome = await this.runRule(rule, jobs);
      if (outcome === 'executed') executed++;
      else if (outcome === 'skipped') skipped++;
    }

    await this.resolvePendingReviews();
    return { scanned: rules.length, executed, skipped, jobs };
  }

  /** 单条规则的执行编排：无商品/无适配器 → skipped；异常 → 落 failed 作业（不计数） */
  private async runRule(
    rule: ShelfRuleEntity,
    jobs: ShelfCycleResult['jobs'],
  ): Promise<'executed' | 'skipped' | 'failed'> {
    const product = await this.productRepo.findOne({
      where: { id: rule.productId, tenantId: rule.tenantId },
    });
    if (!product) return 'skipped';
    const adapter = SHELF_ADAPTERS[rule.platform];
    if (!adapter) return 'skipped';
    try {
      return await this.executeRule(rule, product, adapter, jobs);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await this.saveFailedJob(rule, msg);
      jobs.push({
        ruleId: rule.id,
        productId: rule.productId,
        platform: rule.platform,
        action: 'down',
        status: 'failed',
      });
      this.logger.warn(`[shelf] rule#${rule.id} 执行失败：${msg}`);
      return 'failed';
    }
  }

  /** 决策 → 幂等去重 → 调用适配器 → 落库；无需动作或近期已执行 → skipped */
  private async executeRule(
    rule: ShelfRuleEntity,
    product: ProductEntity,
    adapter: ShelfAdapter,
    jobs: ShelfCycleResult['jobs'],
  ): Promise<'executed' | 'skipped'> {
    const decision = await this.evaluateRule(rule, product, adapter);
    if (decision.action === 'none') {
      rule.lastEvalAt = new Date();
      await this.ruleRepo.save(rule);
      return 'skipped';
    }
    const action: ShelfAction = decision.action;
    if (await this.hasRecentJob(rule.id, action)) return 'skipped';

    const result =
      action === 'up'
        ? await adapter.up(product, rule.params)
        : await adapter.down(product, rule.params);

    await this.applyResult(product, rule, action, result, decision.reason);
    jobs.push({
      ruleId: rule.id,
      productId: rule.productId,
      platform: rule.platform,
      action,
      status: 'done',
    });
    return 'executed';
  }

  /** 幂等防抖：同规则同动作在窗口内已成功执行过则跳过 */
  private async hasRecentJob(ruleId: number, action: ShelfAction): Promise<boolean> {
    const recent = await this.jobRepo.findOne({
      where: {
        ruleId,
        action,
        status: 'done',
        createdAt: MoreThan(new Date(Date.now() - IDEMPOTENT_WINDOW_MS)),
      },
    });
    return !!recent;
  }

  /** 执行失败作业落库（供人工排查） */
  private async saveFailedJob(rule: ShelfRuleEntity, reason: string): Promise<void> {
    await this.jobRepo.save(
      this.jobRepo.create({
        tenantId: rule.tenantId,
        ruleId: rule.id,
        productId: rule.productId,
        platform: rule.platform,
        action: 'down',
        status: 'failed',
        reason,
      }),
    );
  }

  // ============ 策略评估（各策略规则差异） ============

  private async evaluateRule(
    rule: ShelfRuleEntity,
    product: ProductEntity,
    adapter: ShelfAdapter,
  ): Promise<Decision> {
    const current = (await this.currentStatus(
      product.id,
      rule.platform,
      rule.tenantId,
    )) as ShelfStatus;

    switch (rule.strategy) {
      case 'inventory':
        return this.evaluateInventory(rule, product, current);
      case 'time':
        return this.evaluateTime(rule);
      case 'price':
        return this.evaluatePrice(rule, product);
      case 'compliance':
        return this.evaluateCompliance(rule, product, adapter);
      case 'weight':
        return this.evaluateWeight(rule, product, adapter, current);
      default:
        return { action: 'none', reason: `未知策略 ${String(rule.strategy)}` };
    }
  }

  /** 库存策略：低于阈值下架，补货后自动恢复上架 */
  private evaluateInventory(
    rule: ShelfRuleEntity,
    product: ProductEntity,
    current: ShelfStatus,
  ): Decision {
    const p = (rule.params ?? {}) as Record<string, any>;
    const threshold = Number(p.threshold ?? 0);
    const stock = Number(product.stock ?? 0);
    if (stock <= threshold) {
      return { action: 'down', reason: `库存 ${stock} ≤ 阈值 ${threshold}` };
    }
    const autoRestore = p.autoRestore !== false;
    if (autoRestore && current === 'off_sale') {
      return { action: 'up', reason: '补货恢复上架' };
    }
    return { action: 'none', reason: '库存充足且已上架' };
  }

  /** 时间窗策略：在配置的上架窗口内上架，窗口外下架 */
  private evaluateTime(rule: ShelfRuleEntity): Decision {
    const p = (rule.params ?? {}) as Record<string, any>;
    const now = new Date();
    const hhmm = now.getHours() * 60 + now.getMinutes();
    const start = this.toMinutes(p.windowStart);
    const end = this.toMinutes(p.windowEnd);
    const inWindow = start !== null && end !== null && hhmm >= start && hhmm < end;
    if (inWindow) {
      return { action: 'up', reason: `位于上架窗口 ${p.windowStart}-${p.windowEnd}` };
    }
    return { action: 'down', reason: `不在上架窗口（当前 ${hhmm} 分）` };
  }

  /** 价格策略：低于下限或高于上限下架，区间内保持上架 */
  private evaluatePrice(rule: ShelfRuleEntity, product: ProductEntity): Decision {
    const p = (rule.params ?? {}) as Record<string, any>;
    const price = Number(product.price ?? 0);
    const minPrice = Number(p.minPrice ?? 0);
    const maxPrice = p.maxPrice != null ? Number(p.maxPrice) : null;
    if (price < minPrice) {
      return { action: 'down', reason: `价格 ${price} 低于下限 ${minPrice}` };
    }
    if (maxPrice !== null && price > maxPrice) {
      return { action: 'down', reason: `价格 ${price} 高于上限 ${maxPrice}` };
    }
    return { action: 'up', reason: `价格 ${price} 在区间内` };
  }

  /** 合规策略：标题命中高危违禁词或平台预检未通过则下架 */
  private async evaluateCompliance(
    rule: ShelfRuleEntity,
    product: ProductEntity,
    adapter: ShelfAdapter,
  ): Promise<Decision> {
    const scan = await this.compliance.checkText(product.title, 'product-shelf');
    if (scan.level === 'high' || scan.result === 'block') {
      return {
        action: 'down',
        reason: `标题命中高危违禁词：${scan.hits.map((h) => h.word).join('、')}`,
      };
    }
    const pre = await adapter.precheck(product, rule.params);
    if (!pre.ok) {
      return { action: 'down', reason: pre.reason ?? '平台预检未通过' };
    }
    return { action: 'up', reason: '合规与平台预检通过' };
  }

  /** 爆款优先/权重驱动：同平台 weight 规则按 priority 排序，仅排名前 topN 上架，其余下架 */
  private async evaluateWeight(
    rule: ShelfRuleEntity,
    product: ProductEntity,
    adapter: ShelfAdapter,
    current: ShelfStatus,
  ): Promise<Decision> {
    const p = rule.params ?? {};
    const topN = Number(p.topN ?? 1);
    const sortBy = typeof p.sortBy === 'string' ? p.sortBy : 'price';

    const peers = await this.ruleRepo.find({
      where: {
        tenantId: rule.tenantId,
        platform: rule.platform,
        strategy: 'weight',
        enabled: true,
        status: 'active',
      },
    });
    const products = await Promise.all(
      peers.map((r) =>
        this.productRepo.findOne({ where: { id: r.productId, tenantId: r.tenantId } }),
      ),
    );
    const ranked = products
      .filter((pr): pr is ProductEntity => pr !== null)
      .sort((a, b) => {
        if (sortBy === 'price') return Number(b.price ?? 0) - Number(a.price ?? 0);
        return b.createdAt.getTime() - a.createdAt.getTime();
      })
      .map((pr) => pr.id);

    const inTopN = ranked.indexOf(product.id) >= 0 && ranked.indexOf(product.id) < topN;
    if (inTopN) {
      if (current === 'on_sale') return { action: 'none', reason: '排名在 topN 内且已上架' };
      return { action: 'up', reason: `排名第 ${ranked.indexOf(product.id) + 1}，进入 top${topN}` };
    }
    return { action: 'down', reason: `排名第 ${ranked.indexOf(product.id) + 1}，超出 top${topN}` };
  }

  // ============ 结果落库 ============

  private async applyResult(
    product: ProductEntity,
    rule: ShelfRuleEntity,
    action: ShelfAction,
    result: { status: string; extShelfId: string; reviewPending?: boolean },
    reason: string,
  ): Promise<void> {
    const now = new Date();
    let pp = await this.ppRepo.findOne({
      where: { productId: product.id, platform: rule.platform, tenantId: rule.tenantId },
    });
    if (!pp) {
      pp = this.ppRepo.create({
        tenantId: rule.tenantId,
        productId: product.id,
        platform: rule.platform,
        shelfStatus: 'unknown',
      });
    }
    pp.shelfStatus = result.status as ProductPlatformEntity['shelfStatus'];
    pp.extShelfId = result.extShelfId;
    pp.lastAction = action;
    pp.lastActionAt = now;
    await this.ppRepo.save(pp);

    await this.jobRepo.save(
      this.jobRepo.create({
        tenantId: rule.tenantId,
        ruleId: rule.id,
        productId: product.id,
        platform: rule.platform,
        action,
        status: 'done',
        reason,
        platformResult: result as unknown as Record<string, unknown>,
        extShelfId: result.extShelfId,
      }),
    );

    rule.lastEvalAt = now;
    rule.lastAction = action;
    await this.ruleRepo.save(rule);
  }

  /** 模拟平台异步审核：pending_review 超时后自动通过 */
  private async resolvePendingReviews(): Promise<void> {
    const pending = await this.ppRepo.find({ where: { shelfStatus: 'pending_review' } });
    for (const pp of pending) {
      const meta = SHELF_ADAPTERS[pp.platform]?.meta;
      if (!meta || !meta.reviewRequired) continue;
      const since = pp.lastActionAt ?? pp.updatedAt;
      if (since && Date.now() - since.getTime() >= meta.reviewSimMinutes * 60 * 1000) {
        pp.shelfStatus = 'on_sale';
        await this.ppRepo.save(pp);
        this.logger.log(
          `[shelf] ${pp.platform} 商品#${pp.productId} 审核通过，自动上架（${meta.name}）`,
        );
      }
    }
  }

  // ============ 查询 ============

  async listJobs(
    filter: { platform?: string; status?: string; productId?: string } = {},
  ): Promise<ShelfJobEntity[]> {
    const tenantId = TenantContext.requireTenantId();
    return this.jobRepo.find({
      where: { tenantId, ...filter } as never,
      order: { id: 'DESC' },
      take: 100,
    });
  }

  async listProductPlatforms(
    filter: { platform?: string; shelfStatus?: string } = {},
  ): Promise<Array<ProductPlatformEntity & { title: string }>> {
    const tenantId = TenantContext.requireTenantId();
    const list = await this.ppRepo.find({
      where: { tenantId, ...filter } as never,
      order: { id: 'DESC' },
      take: 200,
    });
    const products = await this.productRepo.find({ where: { tenantId } });
    const map = new Map(products.map((p) => [String(p.id), p]));
    return list.map((pp) => ({
      ...pp,
      title: map.get(String(pp.productId))?.title ?? '',
    })) as Array<ProductPlatformEntity & { title: string }>;
  }

  async currentStatus(
    productId: number,
    platform: EcommercePlatform,
    tenantId?: string,
  ): Promise<string> {
    const pp = await this.ppRepo.findOne({
      where: { productId, platform, tenantId: tenantId ?? '' },
    });
    return pp?.shelfStatus ?? 'unknown';
  }

  // ============ 调度 ============

  /** 每 5 分钟全租户巡检（免人工自动上下架） */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async scheduledRun(): Promise<void> {
    try {
      const rules = await this.ruleRepo.find({ where: { enabled: true, status: 'active' } });
      const tenantIds = [...new Set(rules.map((r) => r.tenantId))];
      for (const tenantId of tenantIds) {
        const result = await TenantContext.run({ traceId: `shelf-${Date.now()}`, tenantId }, () =>
          this.runShelfCycle(tenantId),
        );
        if (result.executed > 0) {
          this.logger.log(
            `[shelf] 定时巡检 ${tenantId}：扫描 ${result.scanned} 条规则，执行 ${result.executed} 个动作`,
          );
        }
      }
    } catch (e) {
      this.logger.error(`[shelf] 定时巡检失败：${(e as Error).message}`);
    }
  }

  onModuleDestroy(): void {
    // 无长驻资源；占位保证生命周期钩子一致
  }

  private toMinutes(hhmm: unknown): number | null {
    if (typeof hhmm !== 'string' || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  }
}
