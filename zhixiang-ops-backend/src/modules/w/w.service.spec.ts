import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RevenueService } from './w.service';
import { RevenueRecordEntity, ReconciliationEntity, SettlementEntity } from './index';
import { AdMetricEntity } from '../../modules/s/ad-metric.entity';
import { AuditService } from '../../modules/n/audit.service';
import { AppError } from '../../shared/app-error';
import { TenantContext } from '../../tenant/tenant-context';

const ctx = { traceId: 'w-test', tenantId: 't1' };
const run = <T>(cb: () => T): T => TenantContext.run(ctx, cb);

describe('RevenueService (W 收益与对账)', () => {
  let service: RevenueService;
  const revenueRepo: any = {
    create: jest.fn((x) => x),
    save: jest.fn((x) => Promise.resolve({ ...x, id: 1 })),
    find: jest.fn(),
  };
  const reconRepo: any = {
    create: jest.fn((x) => x),
    save: jest.fn((x) => Promise.resolve({ ...x, id: 1 })),
    findOne: jest.fn(),
  };
  const settleRepo: any = {
    create: jest.fn((x) => x),
    save: jest.fn((x) => Promise.resolve({ ...x, id: 1 })),
    findOne: jest.fn(),
  };
  const adMetricRepo: any = { find: jest.fn() };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RevenueService,
        { provide: getRepositoryToken(RevenueRecordEntity), useValue: revenueRepo },
        { provide: getRepositoryToken(ReconciliationEntity), useValue: reconRepo },
        { provide: getRepositoryToken(SettlementEntity), useValue: settleRepo },
        { provide: getRepositoryToken(AdMetricEntity), useValue: adMetricRepo },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    service = module.get(RevenueService);
  });

  it('R10-01 recordRevenue 录入收益并记录审计', async () => {
    const r = await run(() =>
      service.recordRevenue({
        source: 'commission',
        platform: 'douyin',
        amount: 100,
        commission: 20,
      }),
    );
    expect(r).toMatchObject({
      source: 'commission',
      platform: 'douyin',
      amount: 100,
      commission: 20,
      status: 'pending',
    });
    expect(revenueRepo.save).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'record_revenue' }),
    );
  });

  it('R10-02 listRevenue 多收入汇总（按 source 分组 + 明细）', async () => {
    revenueRepo.find.mockResolvedValue([
      {
        id: 1,
        source: 'commission',
        amount: 100,
        commission: 20,
        status: 'settled',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 2,
        source: 'commission',
        amount: 50,
        commission: 10,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 3,
        source: 'tip',
        amount: 30,
        commission: 0,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    const res = await run(() => service.listRevenue());
    expect(res.summary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'commission', total: 150, count: 2 }),
        expect.objectContaining({ source: 'tip', total: 30, count: 1 }),
      ]),
    );
    expect(res.items).toHaveLength(3);
  });

  it('R10-03 listRevenue 按 source 过滤', async () => {
    revenueRepo.find.mockResolvedValue([
      {
        id: 1,
        source: 'commission',
        amount: 100,
        commission: 20,
        status: 'settled',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    const res = await run(() => service.listRevenue('commission'));
    expect(res.items).toHaveLength(1);
    expect(res.summary[0].source).toBe('commission');
  });

  it('R10-04 reconcile 生成对账（有差额 → diff_found）', async () => {
    revenueRepo.find.mockResolvedValue([
      {
        id: 1,
        source: 'commission',
        amount: 100,
        commission: 20,
        status: 'settled',
        createdAt: new Date('2026-08-10'),
        updatedAt: new Date(),
      },
      {
        id: 2,
        source: 'commission',
        amount: 80,
        commission: 16,
        status: 'pending',
        createdAt: new Date('2026-08-12'),
        updatedAt: new Date(),
      },
      {
        id: 3,
        source: 'tip',
        amount: 30,
        commission: 0,
        status: 'pending',
        createdAt: new Date('2026-07-01'),
        updatedAt: new Date(),
      },
    ]);
    const r = await run(() => service.reconcile({ period: '2026-08' }));
    // 仅 2026-08 两条：orderAmount=180, settled=100, diff=80
    expect(r).toMatchObject({
      period: '2026-08',
      orderAmount: 180,
      settledAmount: 100,
      diff: 80,
      status: 'diff_found',
    });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'reconcile' }));
  });

  it('R10-05 reconcile 全部已结算 → matched', async () => {
    revenueRepo.find.mockResolvedValue([
      {
        id: 1,
        source: 'commission',
        amount: 100,
        commission: 20,
        status: 'settled',
        createdAt: new Date('2026-08-10'),
        updatedAt: new Date(),
      },
    ]);
    const r = await run(() => service.reconcile({ period: '2026-08' }));
    expect(r).toMatchObject({ orderAmount: 100, settledAmount: 100, diff: 0, status: 'matched' });
  });

  it('R10-06 getReconciliation 明细；不存在抛 RECONCILIATION_NOT_FOUND', async () => {
    reconRepo.findOne.mockResolvedValue({
      id: 1,
      period: '2026-08',
      orderAmount: 100,
      commissionAmount: 20,
      settledAmount: 100,
      diff: 0,
      status: 'matched',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const r = await run(() => service.getReconciliation(1));
    expect(r.id).toBe(1);

    reconRepo.findOne.mockResolvedValue(null);
    let err: any;
    try {
      await run(() => service.getReconciliation(9));
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe('RECONCILIATION_NOT_FOUND');
  });

  it('R10-07 settle 分账（各方合计==总额）；金额不匹配抛 SETTLEMENT_PARTIES_MISMATCH', async () => {
    const okDto: any = {
      type: 'org_talent_advertiser',
      amount: 100,
      parties: [
        { role: 'org', name: 'MCN', amount: 30 },
        { role: 'talent', name: '达人A', amount: 60 },
        { role: 'ad_operator', name: '投手B', amount: 10 },
      ],
    };
    const r = await run(() => service.settle(okDto));
    expect(r).toMatchObject({ type: 'org_talent_advertiser', amount: 100, status: 'pending' });
    expect(r.parties).toHaveLength(3);

    const badDto: any = { ...okDto, parties: [{ role: 'org', name: 'X', amount: 50 }] };
    let err: any;
    try {
      await run(() => service.settle(badDto));
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe('SETTLEMENT_PARTIES_MISMATCH');
  });

  it('R10-08 invoice 自动开票 → invoiced；不存在抛 SETTLEMENT_NOT_FOUND', async () => {
    settleRepo.findOne.mockResolvedValue({
      id: 1,
      type: 'org_talent_advertiser',
      parties: [],
      amount: 100,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const r = await run(() => service.invoice(1));
    expect(r.status).toBe('invoiced');
    expect(r.invoiceNo).toMatch(/^INV-1-/);

    settleRepo.findOne.mockResolvedValue(null);
    let err: any;
    try {
      await run(() => service.invoice(9));
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe('SETTLEMENT_NOT_FOUND');
  });

  it('R10-09 profit 利润统计（收入-投流消耗）', async () => {
    revenueRepo.find.mockResolvedValue([
      { amount: 300, commission: 60 },
      { amount: 100, commission: 20 },
    ]);
    adMetricRepo.find.mockResolvedValue([{ cost: 80 }, { cost: 20 }]);
    const p = await run(() => service.profit());
    expect(p).toEqual({ totalRevenue: 400, totalCommission: 80, totalAdCost: 100, netProfit: 300 });
  });
});
