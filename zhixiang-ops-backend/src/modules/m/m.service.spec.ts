import { DashboardService } from './m.service';
import { TenantContext } from '../../tenant/tenant-context';
import type { Repository } from 'typeorm';

/** 内存仓库 mock：find/count/findOne/create/save/softRemove + 链式 createQueryBuilder(sum) */
function makeRepo(seed?: { sum?: string }) {
  return {
    find: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((d: any) => ({ ...d })),
    save: jest.fn(async (e: any) => e),
    softRemove: jest.fn(async (e: any) => e),
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ sum: seed?.sum ?? '0' }),
    })),
  } as unknown as Repository<any>;
}

const TENANT = 't-m-1';

describe('DashboardService（M 决策仪表盘 / 验收点 M-01~09）', () => {
  let service: DashboardService;
  let dashboardRepo: any;
  let topicRepo: any;
  let scriptRepo: any;
  let publishRepo: any;
  let feedbackRepo: any;
  let driverEffRepo: any;
  let accountRepo: any;
  let revenueRepo: any;
  let adCampaignRepo: any;
  let adMetricRepo: any;
  let orderRepo: any;
  let recycleService: any;
  let dashStore: any[];
  let idSeq = 0;

  const overviewMock = {
    totalPlay: 100,
    avgCompleteRate: 0.5,
    totalInteract: 20,
    totalFanInc: 5,
    totalCommission: 10,
    completeRate: 0.1,
    interactRate: 0.2,
    fanRate: 0.05,
    conversionRate: 0.05,
    videoCount: 1,
  };
  const deRows = [
    {
      driver: '贪',
      emotion: '爽感',
      sampleCount: 3,
      avgPlay: 100,
      avgInteractRate: 0.2,
      avgConversion: 0.05,
    },
  ];

  beforeEach(async () => {
    idSeq = 0;
    dashStore = [];
    dashboardRepo = makeRepo();
    dashboardRepo.find = jest.fn(async () => dashStore);
    dashboardRepo.findOne = jest.fn(
      async (opt: any) =>
        dashStore.find((d) => d.id === opt.where.id && d.tenantId === opt.where.tenantId) ?? null,
    );
    dashboardRepo.create = jest.fn((d: any) => ({ ...d }));
    dashboardRepo.save = jest.fn(async (e: any) => {
      if (e.id === undefined) e.id = ++idSeq;
      const i = dashStore.findIndex((d) => d.id === e.id);
      if (i >= 0) dashStore[i] = e;
      else dashStore.push(e);
      return e;
    });
    dashboardRepo.softRemove = jest.fn(async (e: any) => {
      const i = dashStore.indexOf(e);
      if (i >= 0) dashStore.splice(i, 1);
      return e;
    });

    topicRepo = makeRepo();
    topicRepo.find = jest.fn().mockResolvedValue([
      { id: 1, tenantId: TENANT, humanDriver: '贪', emotion: '爽感', score: 0.8 },
      { id: 2, tenantId: TENANT, humanDriver: '贪', emotion: '爽感', score: 0.9 },
      { id: 3, tenantId: TENANT, humanDriver: '怕', emotion: '焦虑', score: 0.4 },
    ]);
    topicRepo.count = jest.fn().mockResolvedValue(3);

    scriptRepo = makeRepo();
    scriptRepo.count = jest.fn().mockResolvedValue(1);

    publishRepo = makeRepo();
    publishRepo.count = jest.fn().mockResolvedValue(1);
    publishRepo.find = jest
      .fn()
      .mockResolvedValue([{ id: 1, tenantId: TENANT, accountId: 1, orderConv: 5 }]);
    publishRepo.createQueryBuilder = jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ sum: '5' }),
    }));

    feedbackRepo = makeRepo();
    feedbackRepo.find = jest.fn().mockResolvedValue([
      {
        id: 1,
        tenantId: TENANT,
        videoId: 1,
        createdAt: new Date(),
        metrics: { play: 100, interact: 20, fanInc: 5, commission: 10, completeRate: 0.5 },
      },
    ]);

    driverEffRepo = makeRepo();
    driverEffRepo.find = jest.fn().mockResolvedValue(deRows);

    accountRepo = makeRepo();
    accountRepo.find = jest
      .fn()
      .mockResolvedValue([
        { id: 1, tenantId: TENANT, nickname: 'A', platform: 'douyin', fansCount: 1000 },
      ]);

    revenueRepo = makeRepo();
    revenueRepo.count = jest.fn().mockResolvedValue(0);
    revenueRepo.sum = '50.00';
    revenueRepo.createQueryBuilder = jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ sum: '50.00' }),
    }));

    adCampaignRepo = makeRepo();
    adCampaignRepo.createQueryBuilder = jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ sum: '10.00' }),
    }));

    adMetricRepo = makeRepo();
    adMetricRepo.createQueryBuilder = jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ sum: '5.00' }),
    }));

    orderRepo = makeRepo();

    recycleService = {
      getDashboardOverview: jest.fn().mockResolvedValue(overviewMock),
      getDriverEfficiency: jest.fn().mockResolvedValue(deRows),
    };

    // 直接构造，注入所有 mock repo（绕过 NestJS DI，沿用项目内存仓库 mock 约定）
    service = new DashboardService(
      recycleService,
      dashboardRepo,
      topicRepo,
      scriptRepo,
      publishRepo,
      feedbackRepo,
      driverEffRepo,
      accountRepo,
      revenueRepo,
      adCampaignRepo,
      adMetricRepo,
      orderRepo,
    );
  });

  /** M-01 核心指标卡复用 J 五维四率 + 趋势 */
  it('getOverview 复用 J 五维四率并返回近7日趋势', async () => {
    const r = await TenantContext.run({ tenantId: TENANT, traceId: 'x' }, () =>
      service.getOverview(),
    );
    expect(r.cards.totalPlay).toBe(100);
    expect(r.cards.completeRate).toBe(0.1);
    expect(r.trend.length).toBe(7);
    const withPlay = r.trend.find((t) => t.play === 100);
    expect(withPlay).toBeDefined();
  });

  /** M-02 overview 优雅降级：J 无数据时返回全 0 空卡（BI 层不阻断） */
  it('getOverview 在 J 抛错时降级全 0 空卡', async () => {
    recycleService.getDashboardOverview.mockRejectedValueOnce(new Error('RECYCLE_NO_DATA'));
    const r = await TenantContext.run({ tenantId: TENANT, traceId: 'x' }, () =>
      service.getOverview(),
    );
    expect(r.cards.totalPlay).toBe(0);
    expect(r.cards.videoCount).toBe(0);
    expect(r.trend.length).toBe(7);
  });

  /** M-03 全链路漏斗聚合（内容生产率→分发覆盖→触达→互动→转化→收益 + ROI） */
  it('getFunnel 聚合各域并返回 ROI', async () => {
    const r = await TenantContext.run({ tenantId: TENANT, traceId: 'x' }, () =>
      service.getFunnel(),
    );
    const byName = Object.fromEntries(r.stages.map((s) => [s.name, s.value]));
    expect(byName['内容生产率']).toBe(4); // topic3+script1
    expect(byName['分发覆盖']).toBe(1);
    expect(byName['触达播放']).toBe(100);
    expect(byName['互动']).toBe(20);
    expect(byName['转化']).toBe(5); // publish orderConv
    expect(byName['收益']).toBe(60); // feedback10 + revenue50
    expect(r.spend).toBe(15); // campaign10 + metric5
    expect(r.roi).toBe(4); // 60/15
  });

  /** M-04 账号对比 */
  it('getAccountCompare 返回账号维度指标与占比', async () => {
    const r = await TenantContext.run({ tenantId: TENANT, traceId: 'x' }, () =>
      service.getAccountCompare(),
    );
    expect(r.accounts.length).toBe(1);
    expect(r.accounts[0].fansCount).toBe(1000);
    expect(r.accounts[0].publishCount).toBe(1);
    expect(r.accounts[0].playShare).toBe(1); // 仅 1 账号占比 100%
    expect(r.totals.fansCount).toBe(1000);
    expect(r.totals.play).toBe(100);
  });

  /** M-05 选题效能榜：按 (driver,emotion) 聚合 score 并排序 */
  it('getTopicEfficiency 聚合选题效能并排序', async () => {
    const r = await TenantContext.run({ tenantId: TENANT, traceId: 'x' }, () =>
      service.getTopicEfficiency(),
    );
    const g = r.items.find((i) => i.driver === '贪' && i.emotion === '爽感');
    expect(g).toBeDefined();
    expect(g!.topicCount).toBe(2);
    expect(g!.avgScore).toBe(0.85); // (0.8+0.9)/2
    expect(g!.avgPlay).toBe(100);
    expect(g!.avgConversion).toBe(0.05);
    expect(r.items[0].driver).toBe('贪'); // 最高分在前（贪0.85 > 怕0.4）
  });

  /** M-06 人性钩子分析（7×6，复用 J 人性效能） */
  it('getHumanHook 复用 J 7×6 人性效能', async () => {
    const r = await TenantContext.run({ tenantId: TENANT, traceId: 'x' }, () =>
      service.getHumanHook(),
    );
    expect(r.items.length).toBe(1);
    expect(r.items[0].driver).toBe('贪');
    expect(r.items[0].emotion).toBe('爽感');
    expect(r.items[0].sampleCount).toBe(3);
    expect(r.items[0].avgPlay).toBe(100);
    expect(r.items[0].avgConversion).toBe(0.05);
  });

  /** M-07 仪表盘配置 CRUD：创建→列表→详情→更新→删除 */
  it('dashboards CRUD 全链路', async () => {
    const created = await TenantContext.run({ tenantId: TENANT, traceId: 'x' }, () =>
      service.createDashboard({ name: '经营看板', widgets: [{ type: 'line' }] }),
    );
    expect(created.id).toBeDefined();
    expect(created.tenantId).toBe(TENANT);

    const list = await TenantContext.run({ tenantId: TENANT, traceId: 'x' }, () =>
      service.listDashboards(),
    );
    expect(list.length).toBe(1);

    const one = await TenantContext.run({ tenantId: TENANT, traceId: 'x' }, () =>
      service.getDashboard(created.id),
    );
    expect(one.name).toBe('经营看板');

    const updated = await TenantContext.run({ tenantId: TENANT, traceId: 'x' }, () =>
      service.updateDashboard(created.id, { name: '经营看板V2' }),
    );
    expect(updated.name).toBe('经营看板V2');

    const del = await TenantContext.run({ tenantId: TENANT, traceId: 'x' }, () =>
      service.deleteDashboard(created.id),
    );
    expect(del.id).toBe(created.id);
  });

  /** M-08 不存在仪表盘抛 DASHBOARD_NOT_FOUND */
  it('getDashboard 不存在抛 DASHBOARD_NOT_FOUND', async () => {
    await expect(
      TenantContext.run({ tenantId: TENANT, traceId: 'x' }, () => service.getDashboard(9999)),
    ).rejects.toMatchObject({ code: 'DASHBOARD_NOT_FOUND' });
  });

  /** M-09 跨租户隔离：聚合查询 where 携带 tenantId */
  it('getAccountCompare 查询携带 tenantId 强隔离', async () => {
    await TenantContext.run({ tenantId: TENANT, traceId: 'x' }, () => service.getAccountCompare());
    expect(accountRepo.find).toHaveBeenCalledWith({ where: { tenantId: TENANT } });
    expect(publishRepo.count).toHaveBeenCalledWith({ where: { tenantId: TENANT, accountId: 1 } });
  });
});
