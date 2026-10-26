import { Logger } from '@nestjs/common';
import { ShelfService } from './shelf.service';
import { ShelfRuleEntity } from './shelf-rule.entity';
import { ShelfJobEntity } from './shelf-job.entity';
import { ProductPlatformEntity } from './product-platform.entity';
import { ProductEntity } from '../r/product.entity';
import { ComplianceService } from '../compliance/compliance.service';
import { SHELF_ADAPTERS } from './shelf.adapters';
import { TenantContext } from '../../tenant/tenant-context';
import { createMockRepo, MockRepo } from '../../test-utils/mock-repo';
import { DataSource } from 'typeorm';

/**
 * ShelfService（电商自动上下架）单元测试。
 * 覆盖：平台适配器差异（标题限制/审核流程）、策略评估（库存/价格/合规/定时/权重）、幂等防抖、执行落库、发布记录。
 * 构造：new ShelfService(mockRuleRepo, mockJobRepo, mockPPRepo, mockProductRepo, mockCompliance, mockDataSource)。
 */

const TENANT = 'tn-1';

/** DataSource mock：transaction 直接执行回调，em.getRepository 按实体返回对应 mock repo */
function makeDataSource(
  ppRepo: MockRepo<ProductPlatformEntity>,
  ruleRepo: MockRepo<ShelfRuleEntity>,
): DataSource {
  return {
    transaction: jest.fn((cb: (em: unknown) => Promise<unknown>) =>
      cb({
        getRepository: (entity: unknown) => {
          if (entity === ProductPlatformEntity) return ppRepo;
          return ruleRepo;
        },
      }),
    ),
  } as unknown as DataSource;
}

function makeProduct(partial: Partial<ProductEntity> = {}): ProductEntity {
  return {
    id: 1,
    tenantId: TENANT,
    title: '测试商品标题',
    stock: 10,
    price: 99,
    category: '家居',
    createdAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date('2026-08-01T00:00:00Z'),
    ...partial,
  } as ProductEntity;
}

function makeRule(partial: Partial<ShelfRuleEntity> = {}): ShelfRuleEntity {
  return {
    id: 1,
    tenantId: TENANT,
    platform: 'taobao',
    productId: 1,
    strategy: 'inventory',
    action: 'auto',
    params: null,
    enabled: true,
    priority: 0,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  } as ShelfRuleEntity;
}

describe('ShelfService 平台适配器差异', () => {
  it('各平台 meta 规则差异齐备（9 平台）', () => {
    expect(Object.keys(SHELF_ADAPTERS).length).toBe(9);
    expect(SHELF_ADAPTERS.taobao.meta.titleMaxLen).toBe(60);
    expect(SHELF_ADAPTERS.amazon.meta.reviewRequired).toBe(true);
    expect(SHELF_ADAPTERS.shopify.meta.reviewRequired).toBe(false);
    expect(SHELF_ADAPTERS['douyin-shop'].meta.region).toBe('cn');
    expect(SHELF_ADAPTERS.taobao.meta.maxOnlineProducts).toBe(1000);
  });

  it('淘宝标题超 60 字预检拒绝上架（平台规则差异）', async () => {
    const pre = await SHELF_ADAPTERS.taobao.precheck({ title: '超'.repeat(61) });
    expect(pre.ok).toBe(false);
    expect(pre.reason).toContain('标题超长');
  });

  it('需要审核的平台上架进入 pending_review（抖店）', async () => {
    const res = await SHELF_ADAPTERS['douyin-shop'].up(
      { id: 1, tenantId: TENANT, title: 'ok', category: '食品' },
      {},
    );
    expect(res.status).toBe('pending_review');
    expect(res.reviewPending).toBe(true);
  });

  it('免审核平台上架直接 on_sale（淘宝）', async () => {
    const res = await SHELF_ADAPTERS.taobao.up({ id: 1, tenantId: TENANT, title: 'ok' }, {});
    expect(res.status).toBe('on_sale');
    expect(res.extShelfId).toMatch(/^shelf_/);
  });

  it('下架保留商品资料（淘宝/亚马逊/shopify）', () => {
    expect(SHELF_ADAPTERS.taobao.meta.downKeepsListing).toBe(true);
    expect(SHELF_ADAPTERS.amazon.meta.downKeepsListing).toBe(true);
    expect(SHELF_ADAPTERS.shopify.meta.downKeepsListing).toBe(true);
  });
});

describe('ShelfService 策略评估', () => {
  let svc: ShelfService;
  let mockRuleRepo: MockRepo<ShelfRuleEntity>;
  let mockJobRepo: MockRepo<ShelfJobEntity>;
  let mockPPRepo: MockRepo<ProductPlatformEntity>;
  let mockProductRepo: MockRepo<ProductEntity>;
  let mockCompliance: { checkText: jest.Mock };

  beforeEach(() => {
    mockRuleRepo = createMockRepo<ShelfRuleEntity>();
    mockJobRepo = createMockRepo<ShelfJobEntity>();
    mockPPRepo = createMockRepo<ProductPlatformEntity>();
    mockProductRepo = createMockRepo<ProductEntity>();
    mockCompliance = { checkText: jest.fn() };
    mockPPRepo.find.mockResolvedValue([]);
    svc = new ShelfService(
      mockRuleRepo as never,
      mockJobRepo as never,
      mockPPRepo as never,
      mockProductRepo as never,
      mockCompliance as unknown as ComplianceService,
      makeDataSource(mockPPRepo, mockRuleRepo),
    );
  });

  it('库存为 0 → 自动下架', async () => {
    const rule = makeRule({ strategy: 'inventory', params: { threshold: 0 } });
    const product = makeProduct({ stock: 0 });
    mockRuleRepo.find.mockResolvedValueOnce([rule]);
    mockProductRepo.findOne.mockResolvedValueOnce(product);
    mockPPRepo.findOne.mockResolvedValueOnce({ shelfStatus: 'on_sale' } as ProductPlatformEntity);
    await svc.runShelfCycle(TENANT);
    const jobs = mockJobRepo.save.mock.calls.map((c: any[]) => c[0]) as ShelfJobEntity[];
    expect(jobs[0].action).toBe('down');
    expect(jobs[0].reason).toContain('库存');
  });

  it('补货后自动恢复上架（autoRestore）', async () => {
    const rule = makeRule({
      strategy: 'inventory',
      params: { threshold: 0, autoRestore: true },
    });
    const product = makeProduct({ stock: 5 });
    mockRuleRepo.find.mockResolvedValueOnce([rule]);
    mockProductRepo.findOne.mockResolvedValueOnce(product);
    mockPPRepo.findOne.mockResolvedValueOnce({ shelfStatus: 'off_sale' } as ProductPlatformEntity);
    await svc.runShelfCycle(TENANT);
    const jobs = mockJobRepo.save.mock.calls.map((c: any[]) => c[0]) as ShelfJobEntity[];
    expect(jobs[0].action).toBe('up');
  });

  it('价格低于下限自动下架', async () => {
    const rule = makeRule({ strategy: 'price', params: { minPrice: 100 } });
    const product = makeProduct({ price: 50 });
    mockRuleRepo.find.mockResolvedValueOnce([rule]);
    mockProductRepo.findOne.mockResolvedValueOnce(product);
    await svc.runShelfCycle(TENANT);
    const jobs = mockJobRepo.save.mock.calls.map((c: any[]) => c[0]) as ShelfJobEntity[];
    expect(jobs[0].action).toBe('down');
    expect(jobs[0].reason).toContain('低于下限');
  });

  it('合规策略：标题命中高危违禁词 → 下架', async () => {
    const rule = makeRule({ strategy: 'compliance' });
    const product = makeProduct({});
    mockRuleRepo.find.mockResolvedValueOnce([rule]);
    mockProductRepo.findOne.mockResolvedValueOnce(product);
    mockCompliance.checkText.mockResolvedValueOnce({
      hits: [{ word: '违禁词', position: 0, level: 'high' }],
      level: 'high',
      score: 100,
      result: 'block',
    });
    await svc.runShelfCycle(TENANT);
    const jobs = mockJobRepo.save.mock.calls.map((c: any[]) => c[0]) as ShelfJobEntity[];
    expect(jobs[0].action).toBe('down');
    expect(jobs[0].reason).toContain('命中高危违禁词');
  });

  it('30 分钟内同动作幂等防抖（不重复执行）', async () => {
    const rule = makeRule({ strategy: 'inventory', params: { threshold: 0 } });
    const product = makeProduct({ stock: 0 });
    mockRuleRepo.find.mockResolvedValueOnce([rule]);
    mockProductRepo.findOne.mockResolvedValueOnce(product);
    mockPPRepo.findOne.mockResolvedValueOnce({ shelfStatus: 'on_sale' } as ProductPlatformEntity);
    mockJobRepo.findOne.mockResolvedValueOnce({
      ruleId: rule.id,
      action: 'down',
      status: 'done',
    } as unknown as ShelfJobEntity);
    const res = await svc.runShelfCycle(TENANT);
    expect(res.executed).toBe(0);
    expect(res.skipped).toBe(1);
  });

  it('定时策略：窗口内上架、窗口外下架', async () => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const windowStart = `${hh}:${mm}`;
    const windowEnd = '23:59';
    const rule = makeRule({ strategy: 'time', params: { windowStart, windowEnd } });
    const product = makeProduct({});
    mockRuleRepo.find.mockResolvedValueOnce([rule]);
    mockProductRepo.findOne.mockResolvedValueOnce(product);
    mockPPRepo.findOne.mockResolvedValueOnce({ shelfStatus: 'off_sale' } as ProductPlatformEntity);
    await svc.runShelfCycle(TENANT);
    const jobs = mockJobRepo.save.mock.calls.map((c: any[]) => c[0]) as ShelfJobEntity[];
    expect(jobs[0].action).toBe('up');

    mockJobRepo.save.mockClear();
    const rule2 = makeRule({
      id: 2,
      strategy: 'time',
      params: { windowStart: '00:00', windowEnd: '00:01' },
    });
    const product2 = makeProduct({ id: 2 });
    mockRuleRepo.find.mockResolvedValueOnce([rule2]);
    mockProductRepo.findOne.mockResolvedValueOnce(product2);
    mockPPRepo.findOne.mockResolvedValueOnce({ shelfStatus: 'on_sale' } as ProductPlatformEntity);
    await svc.runShelfCycle(TENANT);
    const jobs2 = mockJobRepo.save.mock.calls.map((c: any[]) => c[0]) as ShelfJobEntity[];
    expect(jobs2[0].action).toBe('down');
  });
});

describe('ShelfService 规则管理', () => {
  let svc: ShelfService;
  let mockRuleRepo: MockRepo<ShelfRuleEntity>;
  let mockJobRepo: MockRepo<ShelfJobEntity>;
  let mockPPRepo: MockRepo<ProductPlatformEntity>;
  let mockProductRepo: MockRepo<ProductEntity>;
  let mockCompliance: { checkText: jest.Mock };

  beforeEach(() => {
    mockRuleRepo = createMockRepo<ShelfRuleEntity>();
    mockJobRepo = createMockRepo<ShelfJobEntity>();
    mockPPRepo = createMockRepo<ProductPlatformEntity>();
    mockProductRepo = createMockRepo<ProductEntity>();
    mockCompliance = { checkText: jest.fn() };
    mockPPRepo.find.mockResolvedValue([]);
    svc = new ShelfService(
      mockRuleRepo as never,
      mockJobRepo as never,
      mockPPRepo as never,
      mockProductRepo as never,
      mockCompliance as unknown as ComplianceService,
      makeDataSource(mockPPRepo, mockRuleRepo),
    );
  });

  it('创建规则校验商品存在', async () => {
    mockProductRepo.findOne.mockResolvedValueOnce(makeProduct());
    await TenantContext.run({ traceId: 't1', tenantId: TENANT }, () =>
      svc.createRule({ platform: 'taobao', productId: 1, strategy: 'inventory' }),
    );
    const saved = mockRuleRepo.save.mock.calls.map((c: any[]) => c[0]) as ShelfRuleEntity[];
    expect(saved[0].platform).toBe('taobao');
    expect(saved[0].strategy).toBe('inventory');
  });

  it('不支持的平台拒绝创建', async () => {
    mockProductRepo.findOne.mockResolvedValueOnce(makeProduct());
    await expect(
      TenantContext.run({ traceId: 't2', tenantId: TENANT }, () =>
        svc.createRule({ platform: 'eBay' as never, productId: 1, strategy: 'inventory' }),
      ),
    ).rejects.toMatchObject({ code: 'PLATFORM_UNSUPPORTED' });
  });

  it('商品不存在拒绝创建', async () => {
    mockProductRepo.findOne.mockResolvedValueOnce(null);
    await expect(
      TenantContext.run({ traceId: 't3', tenantId: TENANT }, () =>
        svc.createRule({ platform: 'taobao', productId: 999, strategy: 'inventory' }),
      ),
    ).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' });
  });

  it('租户缺失防护', async () => {
    await expect(svc.listRules()).rejects.toMatchObject({ code: 'TENANT_REQUIRED' });
  });

  it('recordPublication 记录平台商品映射（无记录则创建）', async () => {
    mockPPRepo.findOne.mockResolvedValueOnce(null);
    await TenantContext.run({ traceId: 't5', tenantId: TENANT }, () =>
      svc.recordPublication({ id: 7, tenantId: TENANT }, 'douyin-shop', {
        extProductId: 'prod_x',
        status: 'pending_review',
      }),
    );
    const saved = mockPPRepo.save.mock.calls.map((c: any[]) => c[0]) as ProductPlatformEntity[];
    expect(saved[0].platform).toBe('douyin-shop');
    expect(saved[0].productId).toBe(7);
    expect(saved[0].shelfStatus).toBe('pending_review');
    expect(saved[0].extShelfId).toBe('prod_x');
    expect(saved[0].lastAction).toBe('publish');
  });

  it('recordPublicationWithRule 单事务原子落库（平台映射+规则同写）', async () => {
    mockPPRepo.findOne.mockResolvedValueOnce(null);
    const { platformRecord, rule } = await TenantContext.run(
      { traceId: 't6', tenantId: TENANT },
      () =>
        svc.recordPublicationWithRule(
          { id: 8, tenantId: TENANT },
          'taobao',
          { extProductId: 'prod_y', status: 'on_sale' },
          { strategy: 'inventory', action: 'auto', params: { threshold: 0 }, enabled: true },
        ),
    );
    expect(platformRecord.shelfStatus).toBe('on_sale');
    expect(platformRecord.extShelfId).toBe('prod_y');
    expect(rule.productId).toBe(8);
    expect(rule.platform).toBe('taobao');
    expect(rule.strategy).toBe('inventory');
  });

  it('recordPublicationWithRule 不支持平台拒绝（事务前校验）', async () => {
    await expect(
      TenantContext.run({ traceId: 't7', tenantId: TENANT }, () =>
        svc.recordPublicationWithRule(
          { id: 8, tenantId: TENANT },
          'eBay' as never,
          { extProductId: 'x', status: 'on_sale' },
          { strategy: 'inventory', action: 'auto', enabled: true },
        ),
      ),
    ).rejects.toMatchObject({ code: 'PLATFORM_UNSUPPORTED' });
  });
});

/** 构造一套独立 mock 服务（新增分支补齐用例复用，避免重复样板） */
function makeShelfService() {
  const mockRuleRepo = createMockRepo<ShelfRuleEntity>();
  const mockJobRepo = createMockRepo<ShelfJobEntity>();
  const mockPPRepo = createMockRepo<ProductPlatformEntity>();
  const mockProductRepo = createMockRepo<ProductEntity>();
  const mockCompliance = { checkText: jest.fn() };
  mockPPRepo.find.mockResolvedValue([]);
  (mockRuleRepo as unknown as { softDelete: jest.Mock }).softDelete = jest.fn();
  const svc = new ShelfService(
    mockRuleRepo as never,
    mockJobRepo as never,
    mockPPRepo as never,
    mockProductRepo as never,
    mockCompliance as unknown as ComplianceService,
    makeDataSource(mockPPRepo, mockRuleRepo),
  );
  return { svc, mockRuleRepo, mockJobRepo, mockPPRepo, mockProductRepo, mockCompliance };
}

type ShelfTestCtx = ReturnType<typeof makeShelfService>;

describe('ShelfService 规则管理分支补齐', () => {
  let ctx: ShelfTestCtx;
  beforeEach(() => {
    ctx = makeShelfService();
  });

  it('listRules 带筛选条件查询', async () => {
    ctx.mockRuleRepo.find.mockResolvedValueOnce([makeRule()]);
    const res = await TenantContext.run({ traceId: 't10', tenantId: TENANT }, () =>
      ctx.svc.listRules({ platform: 'taobao', strategy: 'inventory', status: 'active' }),
    );
    expect(res).toHaveLength(1);
    expect(ctx.mockRuleRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT, platform: 'taobao' }),
      }),
    );
  });

  it('listRules 无筛选默认按租户查询', async () => {
    ctx.mockRuleRepo.find.mockResolvedValueOnce([]);
    const res = await TenantContext.run({ traceId: 't11', tenantId: TENANT }, () =>
      ctx.svc.listRules(),
    );
    expect(res).toEqual([]);
    expect(ctx.mockRuleRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: TENANT } }),
    );
  });

  it('updateRule 更新全部字段并联动禁用状态', async () => {
    ctx.mockRuleRepo.findOne.mockResolvedValueOnce(makeRule());
    await TenantContext.run({ traceId: 't12', tenantId: TENANT }, () =>
      ctx.svc.updateRule(1, {
        platform: 'jd',
        strategy: 'price',
        action: 'up',
        params: { minPrice: 10 },
        enabled: false,
        priority: 5,
        productId: 9,
      }),
    );
    const saved = ctx.mockRuleRepo.save.mock.calls.map((c: any[]) => c[0]) as ShelfRuleEntity[];
    expect(saved[0].platform).toBe('jd');
    expect(saved[0].strategy).toBe('price');
    expect(saved[0].action).toBe('up');
    expect(saved[0].params).toEqual({ minPrice: 10 });
    expect(saved[0].enabled).toBe(false);
    expect(saved[0].priority).toBe(5);
    expect(saved[0].productId).toBe(9);
    expect(saved[0].status).toBe('disabled');
  });

  it('updateRule 仅部分字段更新，其余保持', async () => {
    const rule = makeRule({ strategy: 'inventory' });
    ctx.mockRuleRepo.findOne.mockResolvedValueOnce(rule);
    await TenantContext.run({ traceId: 't12b', tenantId: TENANT }, () =>
      ctx.svc.updateRule(1, { strategy: 'price' }),
    );
    const saved = ctx.mockRuleRepo.save.mock.calls.map((c: any[]) => c[0]) as ShelfRuleEntity[];
    expect(saved[0].strategy).toBe('price');
    expect(saved[0].priority).toBe(rule.priority);
    expect(saved[0].productId).toBe(rule.productId);
  });

  it('updateRule 启用时恢复 active', async () => {
    ctx.mockRuleRepo.findOne.mockResolvedValueOnce(
      makeRule({ status: 'disabled', enabled: false }),
    );
    await TenantContext.run({ traceId: 't13', tenantId: TENANT }, () =>
      ctx.svc.updateRule(1, { enabled: true }),
    );
    const saved = ctx.mockRuleRepo.save.mock.calls.map((c: any[]) => c[0]) as ShelfRuleEntity[];
    expect(saved[0].status).toBe('active');
  });

  it('updateRule 规则不存在抛错', async () => {
    ctx.mockRuleRepo.findOne.mockResolvedValueOnce(null);
    await expect(
      TenantContext.run({ traceId: 't14', tenantId: TENANT }, () => ctx.svc.updateRule(999, {})),
    ).rejects.toMatchObject({ code: 'SHELF_RULE_NOT_FOUND' });
  });

  it('removeRule 软删除成功', async () => {
    ctx.mockRuleRepo.findOne.mockResolvedValueOnce(makeRule());
    const res = await TenantContext.run({ traceId: 't15', tenantId: TENANT }, () =>
      ctx.svc.removeRule(1),
    );
    expect(res).toEqual({ deleted: true });
    expect(
      (ctx.mockRuleRepo as unknown as { softDelete: jest.Mock }).softDelete,
    ).toHaveBeenCalledWith(1);
  });

  it('removeRule 规则不存在抛错', async () => {
    ctx.mockRuleRepo.findOne.mockResolvedValueOnce(null);
    await expect(
      TenantContext.run({ traceId: 't16', tenantId: TENANT }, () => ctx.svc.removeRule(999)),
    ).rejects.toMatchObject({ code: 'SHELF_RULE_NOT_FOUND' });
  });

  it('recordPublication 已有映射则更新不重建', async () => {
    const existing = {
      id: 5,
      tenantId: TENANT,
      productId: 7,
      platform: 'taobao',
      shelfStatus: 'on_sale',
    } as ProductPlatformEntity;
    ctx.mockPPRepo.findOne.mockResolvedValueOnce(existing);
    await TenantContext.run({ traceId: 't30', tenantId: TENANT }, () =>
      ctx.svc.recordPublication({ id: 7, tenantId: TENANT }, 'taobao', {
        extProductId: 'prod_z',
        status: 'on_sale',
      }),
    );
    const saved = ctx.mockPPRepo.save.mock.calls.map((c: any[]) => c[0]) as ProductPlatformEntity[];
    expect(saved[0].id).toBe(5);
    expect(saved[0].extShelfId).toBe('prod_z');
    expect(saved[0].lastAction).toBe('publish');
    expect(ctx.mockPPRepo.create).not.toHaveBeenCalled();
  });

  it('recordPublicationWithRule 已有映射则更新（事务内不重建）', async () => {
    ctx.mockPPRepo.findOne.mockResolvedValueOnce({
      id: 6,
      tenantId: TENANT,
      productId: 8,
      platform: 'taobao',
    } as ProductPlatformEntity);
    const { platformRecord, rule } = await TenantContext.run(
      { traceId: 't31', tenantId: TENANT },
      () =>
        ctx.svc.recordPublicationWithRule(
          { id: 8, tenantId: TENANT },
          'taobao',
          { extProductId: 'prod_w', status: 'on_sale' },
          { strategy: 'inventory', action: 'auto', enabled: true },
        ),
    );
    expect(platformRecord.extShelfId).toBe('prod_w');
    expect(ctx.mockPPRepo.create).not.toHaveBeenCalled();
    expect(rule.productId).toBe(8);
    expect(rule.platform).toBe('taobao');
  });
});

describe('ShelfService 执行路径分支补齐', () => {
  let ctx: ShelfTestCtx;
  beforeEach(() => {
    ctx = makeShelfService();
  });

  it('商品不存在 → 跳过并计入 skipped', async () => {
    ctx.mockRuleRepo.find.mockResolvedValueOnce([makeRule()]);
    ctx.mockProductRepo.findOne.mockResolvedValueOnce(null);
    const res = await ctx.svc.runShelfCycle(TENANT);
    expect(res.scanned).toBe(1);
    expect(res.skipped).toBe(1);
    expect(ctx.mockJobRepo.save).not.toHaveBeenCalled();
  });

  it('平台适配器缺失 → 跳过', async () => {
    ctx.mockRuleRepo.find.mockResolvedValueOnce([
      makeRule({ platform: 'unknown-platform' as never }),
    ]);
    ctx.mockProductRepo.findOne.mockResolvedValueOnce(makeProduct());
    const res = await ctx.svc.runShelfCycle(TENANT);
    expect(res.skipped).toBe(1);
  });

  it('策略判定 none → 跳过并记录评估时间', async () => {
    const rule = makeRule({ strategy: 'inventory', params: {} });
    ctx.mockRuleRepo.find.mockResolvedValueOnce([rule]);
    ctx.mockProductRepo.findOne.mockResolvedValueOnce(makeProduct({ stock: 5 }));
    ctx.mockPPRepo.findOne.mockResolvedValueOnce({
      shelfStatus: 'on_sale',
    } as ProductPlatformEntity);
    const res = await ctx.svc.runShelfCycle(TENANT);
    expect(res.skipped).toBe(1);
    expect(ctx.mockRuleRepo.save).toHaveBeenCalled();
  });

  it('库存字段为空按 0 处理 → 自动下架', async () => {
    ctx.mockRuleRepo.find.mockResolvedValueOnce([
      makeRule({ strategy: 'inventory', params: { threshold: 0 } }),
    ]);
    ctx.mockProductRepo.findOne.mockResolvedValueOnce(
      makeProduct({ stock: null as unknown as number }),
    );
    ctx.mockPPRepo.findOne.mockResolvedValueOnce({
      shelfStatus: 'on_sale',
    } as ProductPlatformEntity);
    await ctx.svc.runShelfCycle(TENANT);
    const jobs = ctx.mockJobRepo.save.mock.calls.map((c: any[]) => c[0]) as ShelfJobEntity[];
    expect(jobs[0].action).toBe('down');
  });

  it('执行异常（非 Error）→ 落 failed 任务并继续', async () => {
    ctx.mockRuleRepo.find.mockResolvedValueOnce([
      makeRule({ strategy: 'inventory', params: { threshold: 0 } }),
    ]);
    ctx.mockProductRepo.findOne.mockResolvedValueOnce(makeProduct({ stock: 0 }));
    ctx.mockPPRepo.findOne.mockResolvedValue({ shelfStatus: 'on_sale' } as ProductPlatformEntity);
    const spy = jest.spyOn(SHELF_ADAPTERS.taobao, 'down').mockRejectedValueOnce('平台接口超时');
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const res = await ctx.svc.runShelfCycle(TENANT);
    const jobs = ctx.mockJobRepo.save.mock.calls.map((c: any[]) => c[0]) as ShelfJobEntity[];
    const failed = jobs.find((j) => j.status === 'failed');
    expect(failed).toBeDefined();
    expect(failed?.action).toBe('down');
    expect(failed?.reason).toBe('平台接口超时');
    expect(res.executed).toBe(0);
    expect(warnSpy).toHaveBeenCalled();
    spy.mockRestore();
    warnSpy.mockRestore();
  });

  it('价格高于上限 → 自动下架（minPrice 缺省按 0）', async () => {
    ctx.mockRuleRepo.find.mockResolvedValueOnce([
      makeRule({ strategy: 'price', params: { maxPrice: 80 } }),
    ]);
    ctx.mockProductRepo.findOne.mockResolvedValueOnce(makeProduct({ price: 100 }));
    await ctx.svc.runShelfCycle(TENANT);
    const jobs = ctx.mockJobRepo.save.mock.calls.map((c: any[]) => c[0]) as ShelfJobEntity[];
    expect(jobs[0].action).toBe('down');
    expect(jobs[0].reason).toContain('高于上限');
  });

  it('价格在区间内（price 为空按 0）→ 上架', async () => {
    ctx.mockRuleRepo.find.mockResolvedValueOnce([
      makeRule({ strategy: 'price', params: { minPrice: 0, maxPrice: 200 } }),
    ]);
    ctx.mockProductRepo.findOne.mockResolvedValueOnce(
      makeProduct({ price: null as unknown as number }),
    );
    ctx.mockPPRepo.findOne.mockResolvedValue({ shelfStatus: 'off_sale' } as ProductPlatformEntity);
    ctx.mockJobRepo.findOne.mockResolvedValue(null);
    await ctx.svc.runShelfCycle(TENANT);
    const jobs = ctx.mockJobRepo.save.mock.calls.map((c: any[]) => c[0]) as ShelfJobEntity[];
    expect(jobs[0].action).toBe('up');
  });

  it('价格策略未设上限 → 不触发上限判断（上架）', async () => {
    ctx.mockRuleRepo.find.mockResolvedValueOnce([
      makeRule({ strategy: 'price', params: { minPrice: 0 } }),
    ]);
    ctx.mockProductRepo.findOne.mockResolvedValueOnce(makeProduct({ price: 100 }));
    ctx.mockPPRepo.findOne.mockResolvedValue({ shelfStatus: 'off_sale' } as ProductPlatformEntity);
    ctx.mockJobRepo.findOne.mockResolvedValue(null);
    await ctx.svc.runShelfCycle(TENANT);
    const jobs = ctx.mockJobRepo.save.mock.calls.map((c: any[]) => c[0]) as ShelfJobEntity[];
    expect(jobs[0].action).toBe('up');
  });

  it('定时策略窗口参数缺失/非法 → 判定窗口外下架', async () => {
    ctx.mockRuleRepo.find.mockResolvedValueOnce([
      makeRule({ strategy: 'time', params: { windowStart: 'not-a-time' } }),
    ]);
    ctx.mockProductRepo.findOne.mockResolvedValueOnce(makeProduct({}));
    ctx.mockPPRepo.findOne.mockResolvedValueOnce({
      shelfStatus: 'on_sale',
    } as ProductPlatformEntity);
    await ctx.svc.runShelfCycle(TENANT);
    const jobs = ctx.mockJobRepo.save.mock.calls.map((c: any[]) => c[0]) as ShelfJobEntity[];
    expect(jobs[0].action).toBe('down');
  });

  it('定时策略窗口未配置 → 判定窗口外下架', async () => {
    ctx.mockRuleRepo.find.mockResolvedValueOnce([makeRule({ strategy: 'time', params: {} })]);
    ctx.mockProductRepo.findOne.mockResolvedValueOnce(makeProduct({}));
    ctx.mockPPRepo.findOne.mockResolvedValueOnce({
      shelfStatus: 'on_sale',
    } as ProductPlatformEntity);
    await ctx.svc.runShelfCycle(TENANT);
    const jobs = ctx.mockJobRepo.save.mock.calls.map((c: any[]) => c[0]) as ShelfJobEntity[];
    expect(jobs[0].action).toBe('down');
  });

  it('合规扫描未高危但平台预检失败 → 下架', async () => {
    ctx.mockRuleRepo.find.mockResolvedValueOnce([makeRule({ strategy: 'compliance' })]);
    ctx.mockProductRepo.findOne.mockResolvedValueOnce(makeProduct({ title: '超'.repeat(61) }));
    ctx.mockCompliance.checkText.mockResolvedValueOnce({
      hits: [],
      level: 'low',
      score: 0,
      result: 'pass',
    });
    await ctx.svc.runShelfCycle(TENANT);
    const jobs = ctx.mockJobRepo.save.mock.calls.map((c: any[]) => c[0]) as ShelfJobEntity[];
    expect(jobs[0].action).toBe('down');
    expect(jobs[0].reason).toContain('标题超长');
  });

  it('合规策略：预检失败且无原因 → 使用默认文案', async () => {
    ctx.mockRuleRepo.find.mockResolvedValueOnce([makeRule({ strategy: 'compliance' })]);
    ctx.mockProductRepo.findOne.mockResolvedValueOnce(makeProduct({}));
    ctx.mockCompliance.checkText.mockResolvedValueOnce({
      hits: [],
      level: 'low',
      score: 0,
      result: 'pass',
    });
    const spy = jest.spyOn(SHELF_ADAPTERS.taobao, 'precheck').mockResolvedValueOnce({ ok: false });
    await ctx.svc.runShelfCycle(TENANT);
    const jobs = ctx.mockJobRepo.save.mock.calls.map((c: any[]) => c[0]) as ShelfJobEntity[];
    expect(jobs[0].action).toBe('down');
    expect(jobs[0].reason).toBe('平台预检未通过');
    spy.mockRestore();
  });

  it('合规扫描与平台预检均通过 → 上架', async () => {
    ctx.mockRuleRepo.find.mockResolvedValueOnce([makeRule({ strategy: 'compliance' })]);
    ctx.mockProductRepo.findOne.mockResolvedValueOnce(makeProduct({ title: 'ok' }));
    ctx.mockCompliance.checkText.mockResolvedValueOnce({
      hits: [],
      level: 'low',
      score: 0,
      result: 'pass',
    });
    ctx.mockPPRepo.findOne.mockResolvedValue({ shelfStatus: 'off_sale' } as ProductPlatformEntity);
    ctx.mockJobRepo.findOne.mockResolvedValue(null);
    await ctx.svc.runShelfCycle(TENANT);
    const jobs = ctx.mockJobRepo.save.mock.calls.map((c: any[]) => c[0]) as ShelfJobEntity[];
    expect(jobs[0].action).toBe('up');
  });

  it('合规扫描 result=block（level 非 high）→ 下架', async () => {
    ctx.mockRuleRepo.find.mockResolvedValueOnce([makeRule({ strategy: 'compliance' })]);
    ctx.mockProductRepo.findOne.mockResolvedValueOnce(makeProduct({}));
    ctx.mockCompliance.checkText.mockResolvedValueOnce({
      hits: [{ word: 'w', position: 0, level: 'low' }],
      level: 'low',
      score: 10,
      result: 'block',
    });
    await ctx.svc.runShelfCycle(TENANT);
    const jobs = ctx.mockJobRepo.save.mock.calls.map((c: any[]) => c[0]) as ShelfJobEntity[];
    expect(jobs[0].action).toBe('down');
  });
});

describe('ShelfService weight 权重策略分支', () => {
  let ctx: ShelfTestCtx;
  beforeEach(() => {
    ctx = makeShelfService();
  });

  const weightRule = (id: number, productId: number, topN = 2, sortBy = 'price') =>
    makeRule({ id, productId, strategy: 'weight' as const, params: { topN, sortBy } });

  /** 配置 3 条 weight 规则（商品 1/2/3，价格 100/200/50），返回 runShelfCycle 的规则 */
  function mockWeightPeers(rule: ShelfRuleEntity, product3Null = false) {
    ctx.mockRuleRepo.find.mockResolvedValueOnce([rule]);
    ctx.mockRuleRepo.find.mockResolvedValueOnce([
      rule,
      weightRule(2, 2, (rule.params as { topN: number }).topN, 'price'),
      weightRule(3, 3, (rule.params as { topN: number }).topN, 'price'),
    ]);
    ctx.mockProductRepo.findOne.mockResolvedValueOnce(makeProduct({ id: 1, price: 100 }));
    ctx.mockProductRepo.findOne
      .mockResolvedValueOnce(makeProduct({ id: 1, price: 100 }))
      .mockResolvedValueOnce(makeProduct({ id: 2, price: 200 }));
    if (product3Null) {
      ctx.mockProductRepo.findOne.mockResolvedValueOnce(null);
    } else {
      ctx.mockProductRepo.findOne.mockResolvedValueOnce(makeProduct({ id: 3, price: 50 }));
    }
  }

  it('排名进入 topN 且已上架 → 不动作（none）', async () => {
    const rule = weightRule(1, 1);
    mockWeightPeers(rule);
    ctx.mockPPRepo.findOne.mockResolvedValue({ shelfStatus: 'on_sale' } as ProductPlatformEntity);
    const res = await ctx.svc.runShelfCycle(TENANT);
    // 排序 [2,1,3]，商品1 排名第 2，topN=2 → 命中且已上架 → none
    expect(res.skipped).toBe(1);
    expect(ctx.mockRuleRepo.save).toHaveBeenCalled();
  });

  it('排名进入 topN 且未上架 → 上架', async () => {
    const rule = weightRule(1, 1);
    mockWeightPeers(rule);
    ctx.mockPPRepo.findOne.mockResolvedValue({ shelfStatus: 'off_sale' } as ProductPlatformEntity);
    ctx.mockJobRepo.findOne.mockResolvedValue(null);
    await ctx.svc.runShelfCycle(TENANT);
    const jobs = ctx.mockJobRepo.save.mock.calls.map((c: any[]) => c[0]) as ShelfJobEntity[];
    expect(jobs[0].action).toBe('up');
  });

  it('排名超出 topN → 下架', async () => {
    const rule = weightRule(1, 1, 1);
    mockWeightPeers(rule);
    ctx.mockPPRepo.findOne.mockResolvedValue({ shelfStatus: 'on_sale' } as ProductPlatformEntity);
    ctx.mockJobRepo.findOne.mockResolvedValue(null);
    await ctx.svc.runShelfCycle(TENANT);
    const jobs = ctx.mockJobRepo.save.mock.calls.map((c: any[]) => c[0]) as ShelfJobEntity[];
    expect(jobs[0].action).toBe('down');
    expect(jobs[0].reason).toContain('超出 top');
  });

  it('同组商品缺失时被过滤（不影响排名）', async () => {
    const rule = weightRule(1, 1);
    mockWeightPeers(rule, true);
    ctx.mockPPRepo.findOne.mockResolvedValue({ shelfStatus: 'on_sale' } as ProductPlatformEntity);
    const res = await ctx.svc.runShelfCycle(TENANT);
    // 商品3 缺失 → ranked=[2,1]，商品1 排名第 2 → 命中且已上架 → none
    expect(res.skipped).toBe(1);
  });

  it('按 createdAt 排序（非价格）', async () => {
    const rule = weightRule(1, 1, 2, 'createdAt');
    ctx.mockRuleRepo.find.mockResolvedValueOnce([rule]);
    ctx.mockRuleRepo.find.mockResolvedValueOnce([
      rule,
      weightRule(2, 2, 2, 'createdAt'),
      weightRule(3, 3, 2, 'createdAt'),
    ]);
    ctx.mockProductRepo.findOne.mockResolvedValueOnce(
      makeProduct({ id: 1, createdAt: new Date('2026-08-02T00:00:00Z') }),
    );
    ctx.mockProductRepo.findOne
      .mockResolvedValueOnce(makeProduct({ id: 1, createdAt: new Date('2026-08-02T00:00:00Z') }))
      .mockResolvedValueOnce(makeProduct({ id: 2, createdAt: new Date('2026-08-03T00:00:00Z') }))
      .mockResolvedValueOnce(makeProduct({ id: 3, createdAt: new Date('2026-08-01T00:00:00Z') }));
    ctx.mockPPRepo.findOne.mockResolvedValue({ shelfStatus: 'off_sale' } as ProductPlatformEntity);
    ctx.mockJobRepo.findOne.mockResolvedValue(null);
    await ctx.svc.runShelfCycle(TENANT);
    const jobs = ctx.mockJobRepo.save.mock.calls.map((c: any[]) => c[0]) as ShelfJobEntity[];
    // 按 createdAt 倒序 [2,1,3]，商品1 第 2 → 上架
    expect(jobs[0].action).toBe('up');
  });
});

describe('ShelfService 审核流转、查询与调度分支', () => {
  let ctx: ShelfTestCtx;
  beforeEach(() => {
    ctx = makeShelfService();
  });

  const pendingPP = (platform: string, lastActionAt: Date | null, updatedAt: Date | null = null) =>
    ({
      id: 1,
      tenantId: TENANT,
      productId: 1,
      platform,
      shelfStatus: 'pending_review',
      lastActionAt,
      updatedAt,
    }) as ProductPlatformEntity;

  it('pending_review 超过审核时长自动转 on_sale', async () => {
    ctx.mockRuleRepo.find.mockResolvedValue([]);
    ctx.mockPPRepo.find.mockResolvedValueOnce([
      pendingPP('douyin-shop', new Date(Date.now() - 120_000)),
    ]);
    await ctx.svc.runShelfCycle();
    const saved = ctx.mockPPRepo.save.mock.calls.map((c: any[]) => c[0]) as ProductPlatformEntity[];
    expect(saved[0].shelfStatus).toBe('on_sale');
  });

  it('免审核平台 pending_review 不自动通过', async () => {
    ctx.mockRuleRepo.find.mockResolvedValue([]);
    ctx.mockPPRepo.find.mockResolvedValueOnce([
      pendingPP('taobao', new Date(Date.now() - 120_000)),
    ]);
    await ctx.svc.runShelfCycle();
    expect(ctx.mockPPRepo.save).not.toHaveBeenCalled();
  });

  it('未注册适配器平台 pending_review 跳过', async () => {
    ctx.mockRuleRepo.find.mockResolvedValue([]);
    ctx.mockPPRepo.find.mockResolvedValueOnce([
      pendingPP('unknown-platform', new Date(Date.now() - 120_000)),
    ]);
    await ctx.svc.runShelfCycle();
    expect(ctx.mockPPRepo.save).not.toHaveBeenCalled();
  });

  it('审核时长未到不自动通过', async () => {
    ctx.mockRuleRepo.find.mockResolvedValue([]);
    ctx.mockPPRepo.find.mockResolvedValueOnce([
      pendingPP('douyin-shop', new Date(Date.now() - 10_000)),
    ]);
    await ctx.svc.runShelfCycle();
    expect(ctx.mockPPRepo.save).not.toHaveBeenCalled();
  });

  it('无动作时间戳的 pending_review 跳过', async () => {
    ctx.mockRuleRepo.find.mockResolvedValue([]);
    ctx.mockPPRepo.find.mockResolvedValueOnce([pendingPP('douyin-shop', null, null)]);
    await ctx.svc.runShelfCycle();
    expect(ctx.mockPPRepo.save).not.toHaveBeenCalled();
  });

  it('listJobs 按筛选查询', async () => {
    ctx.mockJobRepo.find.mockResolvedValueOnce([{ id: 1 } as ShelfJobEntity]);
    const res = await TenantContext.run({ traceId: 't20', tenantId: TENANT }, () =>
      ctx.svc.listJobs({ platform: 'taobao', status: 'done', productId: '1' }),
    );
    expect(res).toHaveLength(1);
    expect(ctx.mockJobRepo.find).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
  });

  it('listProductPlatforms 补齐商品标题', async () => {
    ctx.mockPPRepo.find.mockResolvedValueOnce([
      {
        id: 1,
        tenantId: TENANT,
        productId: 1,
        platform: 'taobao',
        shelfStatus: 'on_sale',
      } as ProductPlatformEntity,
    ]);
    ctx.mockProductRepo.find.mockResolvedValueOnce([makeProduct({ id: 1, title: '补齐标题' })]);
    const res = await TenantContext.run({ traceId: 't21', tenantId: TENANT }, () =>
      ctx.svc.listProductPlatforms(),
    );
    expect(res[0].title).toBe('补齐标题');
  });

  it('listProductPlatforms 商品缺失标题为空串', async () => {
    ctx.mockPPRepo.find.mockResolvedValueOnce([
      {
        id: 2,
        tenantId: TENANT,
        productId: 999,
        platform: 'taobao',
        shelfStatus: 'on_sale',
      } as ProductPlatformEntity,
    ]);
    ctx.mockProductRepo.find.mockResolvedValueOnce([makeProduct({ id: 1 })]);
    const res = await TenantContext.run({ traceId: 't22', tenantId: TENANT }, () =>
      ctx.svc.listProductPlatforms({ platform: 'taobao' }),
    );
    expect(res[0].title).toBe('');
  });

  it('currentStatus 有映射返回平台状态', async () => {
    ctx.mockPPRepo.findOne.mockResolvedValueOnce({
      shelfStatus: 'on_sale',
    } as ProductPlatformEntity);
    const s = await ctx.svc.currentStatus(1, 'taobao', TENANT);
    expect(s).toBe('on_sale');
  });

  it('currentStatus 无映射返回 unknown（未传租户）', async () => {
    ctx.mockPPRepo.findOne.mockResolvedValueOnce(null);
    const s = await ctx.svc.currentStatus(1, 'taobao');
    expect(s).toBe('unknown');
  });

  it('scheduledRun 无启用规则直接返回', async () => {
    ctx.mockRuleRepo.find.mockResolvedValueOnce([]);
    await expect(ctx.svc.scheduledRun()).resolves.toBeUndefined();
  });

  it('scheduledRun 多租户巡检：有执行的租户记录日志', async () => {
    const rule1 = makeRule({ tenantId: 't-a', strategy: 'inventory', params: { threshold: 0 } });
    const rule2 = makeRule({
      id: 2,
      tenantId: 't-b',
      strategy: 'inventory',
      params: { threshold: 0 },
    });
    ctx.mockRuleRepo.find.mockResolvedValueOnce([rule1, rule2]);
    ctx.mockRuleRepo.find.mockResolvedValueOnce([rule1]);
    ctx.mockProductRepo.findOne.mockResolvedValueOnce(makeProduct({ stock: 0 }));
    ctx.mockPPRepo.findOne.mockResolvedValueOnce({
      shelfStatus: 'on_sale',
    } as ProductPlatformEntity);
    ctx.mockRuleRepo.find.mockResolvedValueOnce([]);
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    await ctx.svc.scheduledRun();
    expect(logSpy).toHaveBeenCalledTimes(1);
    logSpy.mockRestore();
  });

  it('scheduledRun 巡检异常被捕获记录 error', async () => {
    ctx.mockRuleRepo.find.mockRejectedValueOnce(new Error('db down'));
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    await expect(ctx.svc.scheduledRun()).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
