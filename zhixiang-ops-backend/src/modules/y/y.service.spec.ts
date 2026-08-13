import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TenantContext } from '../../tenant/tenant-context';
import { OrderService } from './y.service';
import { OrderEntity, LogisticsTrackEntity, WaybillEntity } from './index';
import { ProductService } from '../r/product.service';
import { AuditService } from '../n/audit.service';
import { IntegrationService } from '../../integration/integration.service';
import { decryptJSON } from '../../shared/crypto';

const TENANT = 'y-test-tenant';
const ctx = { traceId: 'y-test', tenantId: TENANT };
const run = <T>(cb: () => Promise<T>): Promise<T> => TenantContext.run(ctx, cb);

function matchWhere(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([k, v]) => row[k] === v);
}

/** 内存仓库 mock（与项目 spec 约定一致，自包含、可跨调用保持状态） */
class MemRepo<T extends { id?: number }> {
  private rows: T[] = [];
  private seq = 1;
  create(partial: Partial<T>): T {
    return { ...(partial as object) } as T;
  }
  async save(e: T): Promise<T> {
    if (e.id == null) (e as { id: number }).id = this.seq++;
    const idx = this.rows.findIndex((r) => r.id === e.id);
    if (idx >= 0) this.rows[idx] = { ...this.rows[idx], ...e };
    else this.rows.push({ ...e });
    return e;
  }
  async findOne(opts: { where: Record<string, unknown> }): Promise<T | null> {
    return this.rows.find((r) => matchWhere(r as Record<string, unknown>, opts.where)) ?? null;
  }
  async find(opts: { where?: Record<string, unknown> } = {}): Promise<T[]> {
    return this.rows.filter((r) =>
      opts.where ? matchWhere(r as Record<string, unknown>, opts.where) : true,
    );
  }
  async count(opts: { where: Record<string, unknown> }): Promise<number> {
    return this.rows.filter((r) => matchWhere(r as Record<string, unknown>, opts.where)).length;
  }
  clear() {
    this.rows = [];
    this.seq = 1;
  }
}

describe('OrderService (Y 订单与物流)', () => {
  let svc: OrderService;
  let orderRepo: MemRepo<OrderEntity>;
  let trackRepo: MemRepo<LogisticsTrackEntity>;
  let waybillRepo: MemRepo<WaybillEntity>;
  let mockProduct: { updateStock: jest.Mock; list: jest.Mock };
  let mockAudit: { record: jest.Mock };
  let mockIntegration: { isStandalone: jest.Mock };

  beforeAll(async () => {
    orderRepo = new MemRepo<OrderEntity>();
    trackRepo = new MemRepo<LogisticsTrackEntity>();
    waybillRepo = new MemRepo<WaybillEntity>();
    mockProduct = {
      updateStock: jest.fn(async (id: number, _dto: { delta: number }) => ({ id, stock: 0 })),
      list: jest.fn(async () => []),
    };
    mockAudit = { record: jest.fn(async () => undefined) };
    mockIntegration = { isStandalone: jest.fn(() => true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: getRepositoryToken(OrderEntity), useValue: orderRepo },
        { provide: getRepositoryToken(LogisticsTrackEntity), useValue: trackRepo },
        { provide: getRepositoryToken(WaybillEntity), useValue: waybillRepo },
        { provide: ProductService, useValue: mockProduct },
        { provide: AuditService, useValue: mockAudit },
        { provide: IntegrationService, useValue: mockIntegration },
      ],
    }).compile();

    svc = module.get(OrderService);
  });

  beforeEach(() => {
    orderRepo.clear();
    trackRepo.clear();
    waybillRepo.clear();
    jest.clearAllMocks();
    mockProduct.updateStock.mockImplementation(async (id: number) => ({ id, stock: 0 }));
    mockProduct.list.mockImplementation(async () => []);
  });

  it('Y-01 同步订单幂等：重复同步同一 platform 订单仅创建一次', async () => {
    const orders = [{ orderId: 'P-1', platform: 'douyin', amount: 100, productId: 1, quantity: 2 }];
    const r1 = await run(() => svc.syncOrders({ source: 'platform', orders } as any));
    expect(r1.created).toBe(1);
    const r2 = await run(() => svc.syncOrders({ source: 'platform', orders } as any));
    expect(r2.created).toBe(0);
    expect(r2.updated).toBe(0);
    expect(await orderRepo.count({ where: { tenantId: TENANT, orderId: 'P-1' } })).toBe(1);
  });

  it('Y-02 双源接入跑通：management / platform 均可同步', async () => {
    const m = await run(() =>
      svc.syncOrders({
        source: 'management',
        orders: [{ orderId: 'M-1', platform: 'sys', amount: 50 }] as any,
      }),
    );
    const p = await run(() =>
      svc.syncOrders({
        source: 'platform',
        orders: [{ orderId: 'P-2', platform: 'douyin', amount: 60 }] as any,
      }),
    );
    expect(m.created).toBe(1);
    expect(p.created).toBe(1);
    const m1 = await orderRepo.findOne({ where: { tenantId: TENANT, orderId: 'M-1' } });
    const p1 = await orderRepo.findOne({ where: { tenantId: TENANT, orderId: 'P-2' } });
    expect(m1?.source).toBe('management');
    expect(p1?.source).toBe('platform');
  });

  it('Y-03 库存联动：已支付订单扣减 R 库存；退款回写', async () => {
    mockProduct.updateStock.mockImplementation(async (id: number, dto: { delta: number }) => ({
      id,
      stock: 100 + dto.delta,
    }));
    await run(() =>
      svc.syncOrders({
        source: 'platform',
        orders: [
          {
            orderId: 'K-1',
            platform: 'douyin',
            amount: 100,
            productId: 9,
            quantity: 3,
            status: 'paid',
          },
        ],
      } as any),
    );
    expect(mockProduct.updateStock).toHaveBeenCalledWith(9, { delta: -3 });
    const order = await orderRepo.findOne({ where: { tenantId: TENANT, orderId: 'K-1' } });
    const refunded = await run(() => svc.refund(order!.id));
    expect(refunded.status).toBe('refunded');
    expect(mockProduct.updateStock).toHaveBeenCalledWith(9, { delta: 3 });
  });

  it('Y-04 attribution 贯通：订单记录归因标识', async () => {
    const r = await run(() =>
      svc.syncOrders({
        source: 'platform',
        orders: [{ orderId: 'A-1', platform: 'douyin', amount: 10, attributionId: 'attr_abc123' }],
      } as any),
    );
    expect(r.created).toBe(1);
    const e = await orderRepo.findOne({ where: { tenantId: TENANT, orderId: 'A-1' } });
    expect(e?.attributionId).toBe('attr_abc123');
  });

  it('Y-05 收货信息加密落库 + 详情脱敏展示', async () => {
    const buyer = {
      name: '张三',
      phone: '13800001111',
      address: '北京市朝阳区某某路1号',
      buyerRef: 'u-99',
    };
    await run(() =>
      svc.syncOrders({
        source: 'platform',
        orders: [{ orderId: 'B-1', platform: 'douyin', amount: 10, buyer }],
      } as any),
    );
    const e = await orderRepo.findOne({ where: { tenantId: TENANT, orderId: 'B-1' } });
    expect(e?.buyerInfo).toBeDefined();
    expect(e?.buyerInfo).not.toContain('13800001111'); // 落库已加密
    expect(() => decryptJSON(e!.buyerInfo as string)).not.toThrow();
    const view = await run(() => svc.getOrder(e!.id));
    expect(view.buyer?.phone).toBe('138****1111'); // 脱敏
    expect(view.buyer?.name).toBe('张*');
    expect(view.buyer?.address).toContain('***');
  });

  it('Y-06 订单详情不存在 → ORDER_NOT_FOUND', async () => {
    await expect(run(() => svc.getOrder(999999))).rejects.toMatchObject({
      code: 'ORDER_NOT_FOUND',
    });
    await expect(run(() => svc.refund(999999))).rejects.toMatchObject({ code: 'ORDER_NOT_FOUND' });
  });

  it('Y-07 物流轨迹查询：空/有记录', async () => {
    const order = await orderRepo.save(
      orderRepo.create({
        tenantId: TENANT,
        source: 'platform',
        platform: 'douyin',
        orderId: 'L-1',
        amount: 10,
      } as any),
    );
    let tracks = await run(() => svc.getLogisticsTrack(order.id));
    expect(tracks).toEqual([]);
    await trackRepo.save(
      trackRepo.create({
        tenantId: TENANT,
        orderId: order.id,
        carrier: 'sf',
        trackingNo: 'T1',
        status: 'in_transit',
        node: '已揽收',
        ts: new Date(),
      }),
    );
    tracks = await run(() => svc.getLogisticsTrack(order.id));
    expect(tracks.length).toBe(1);
    expect(tracks[0].carrier).toBe('sf');
  });

  it('Y-08 生成电子面单：order→waybill；订单不存在 → ORDER_NOT_FOUND', async () => {
    const order = await orderRepo.save(
      orderRepo.create({
        tenantId: TENANT,
        source: 'platform',
        platform: 'douyin',
        orderId: 'W-1',
        amount: 10,
      } as any),
    );
    const wb = await run(() => svc.createWaybill(order.id, { carrier: 'sf' }));
    expect(wb.printStatus).toBe('pending');
    expect(wb.trackingNo).toContain('WB-');
    expect(
      await waybillRepo.findOne({ where: { tenantId: TENANT, orderId: order.id } }),
    ).toBeDefined();
    await expect(run(() => svc.createWaybill(999999, {}))).rejects.toMatchObject({
      code: 'ORDER_NOT_FOUND',
    });
  });

  it('Y-09 批量生成面单：跳过不存在订单，返回成功数', async () => {
    const o1 = await orderRepo.save(
      orderRepo.create({
        tenantId: TENANT,
        source: 'platform',
        platform: 'douyin',
        orderId: 'BW-1',
        amount: 10,
      } as any),
    );
    const o2 = await orderRepo.save(
      orderRepo.create({
        tenantId: TENANT,
        source: 'platform',
        platform: 'douyin',
        orderId: 'BW-2',
        amount: 10,
      } as any),
    );
    const r = await run(() =>
      svc.batchWaybill({ orderIds: [o1.id, o2.id, 999999], carrier: 'yt' }),
    );
    expect(r.count).toBe(2);
    expect(await waybillRepo.count({ where: { tenantId: TENANT } })).toBe(2);
  });

  it('Y-10 库存预警：列出库存 <= 阈值的商品', async () => {
    mockProduct.list.mockImplementation(
      async () =>
        [
          { id: 1, title: '充裕', stock: 100 },
          { id: 2, title: '紧张', stock: 5 },
          { id: 3, title: '缺货', stock: 0 },
        ] as any,
    );
    const warn = await run(() => svc.inventoryWarn(10));
    expect(warn.map((w) => w.id).sort((a, b) => a - b)).toEqual([2, 3]);
    const warn2 = await run(() => svc.inventoryWarn(0));
    expect(warn2.map((w) => w.id)).toEqual([3]);
  });

  it('Y-11 订单列表按 status / platform 过滤', async () => {
    await run(() =>
      svc.syncOrders({
        source: 'platform',
        orders: [
          { orderId: 'F-1', platform: 'douyin', amount: 10, status: 'paid' },
          { orderId: 'F-2', platform: 'douyin', amount: 20, status: 'refunded' },
          { orderId: 'F-3', platform: 'wechat', amount: 30, status: 'paid' },
        ],
      } as any),
    );
    const paid = await run(() => svc.listOrders({ status: 'paid' }));
    expect(paid.length).toBe(2);
    const wx = await run(() => svc.listOrders({ platform: 'wechat' }));
    expect(wx.length).toBe(1);
    expect(wx[0].orderId).toBe('F-3');
  });
});
