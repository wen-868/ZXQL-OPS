import { TenantContext } from '../../tenant/tenant-context';
import { TalentCommerceService } from './v.service';
import { BrandOrderEntity } from './brand-order.entity';
import { CreateTalentDto } from './dto';

const ctx = { tenantId: '1', traceId: 't' };
const run = <T>(cb: () => T): T => TenantContext.run(ctx, cb);

/** 直接实例化 service（不走 Nest DI），隔离验证 V 达人与商单业务逻辑。 */
describe('TalentCommerceService (V 达人/商单管理)', () => {
  let svc: TalentCommerceService;
  let talentRepo: any;
  let orderRepo: any;
  let productRepo: any;
  let videoRepo: any;
  let revenueService: any;
  let audit: any;

  beforeEach(() => {
    const mk = () => ({
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation(async (e: any) => ({ ...e, id: e.id ?? 7 })),
      softDelete: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockImplementation((e: any) => e),
    });
    talentRepo = mk();
    orderRepo = mk();
    productRepo = mk();
    videoRepo = mk();
    revenueService = { settle: jest.fn().mockResolvedValue({ id: 99 }) };
    audit = { record: jest.fn().mockResolvedValue({}) };
    svc = new TalentCommerceService(
      talentRepo,
      orderRepo,
      productRepo,
      videoRepo,
      revenueService,
      audit,
    );
  });

  it('createTalent 落库 + 写审计', async () => {
    const dto: CreateTalentDto = { name: '达人A', talentShareRate: 60 };
    const r = await run(() => svc.createTalent(dto));
    expect(r.id).toBe(7);
    expect(r.tenantId).toBe('1');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'create', module: 'talent' }),
    );
  });

  it('getTalent 不存在 → TALENT_NOT_FOUND', async () => {
    talentRepo.findOne.mockResolvedValueOnce(null);
    await expect(run(() => svc.getTalent(1))).rejects.toMatchObject({ code: 'TALENT_NOT_FOUND' });
  });

  it('createBrandOrder 校验达人存在 + 弱关联 R/H 校验 + 写审计', async () => {
    const talent = { id: 5, tenantId: '1', agencyShareRate: 10, talentShareRate: 60 };
    talentRepo.findOne.mockResolvedValueOnce(talent);
    const r = await run(() =>
      svc.createBrandOrder({ advertiser: '品牌X', talentId: 5, amount: 1000 } as any),
    );
    expect(r.talentId).toBe(5);
    expect(r.agencyShareRate).toBe(10);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'create', module: 'brand_order' }),
    );
  });

  it('createBrandOrder productId 不存在 → PRODUCT_NOT_FOUND', async () => {
    talentRepo.findOne.mockResolvedValueOnce({ id: 5, tenantId: '1' });
    productRepo.findOne.mockResolvedValueOnce(null);
    await expect(
      run(() =>
        svc.createBrandOrder({ advertiser: 'B', talentId: 5, amount: 10, productId: 99 } as any),
      ),
    ).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' });
  });

  it('settleBrandOrder 复用 W 分账引擎 + 回填 settlementId/status', async () => {
    const order = {
      id: 3,
      tenantId: '1',
      advertiser: '品牌X',
      talentId: 5,
      amount: '1000',
      talentShareRate: 0,
      agencyShareRate: 0,
      status: 'completed',
      settlementId: undefined,
    } as unknown as BrandOrderEntity;
    orderRepo.findOne.mockResolvedValueOnce(order);
    talentRepo.findOne.mockResolvedValueOnce({ id: 5, tenantId: '1', name: '达人A' });
    const r = await run(() => svc.settleBrandOrder(3, { talentShareRate: 60 } as any));
    expect(revenueService.settle).toHaveBeenCalledWith({
      type: 'org_talent_advertiser',
      amount: 1000,
      parties: [
        { role: 'talent', amount: 600, name: '达人A' },
        { role: 'org', amount: 400, name: '品牌X' },
      ],
    });
    expect(r.settlementId).toBe(99);
    expect(r.status).toBe('settled');
    expect(r.talentShareRate).toBe(60);
  });

  it('settleBrandOrder 重复分账 → BRAND_ORDER_ALREADY_SETTLED', async () => {
    const order = {
      id: 3,
      tenantId: '1',
      advertiser: 'B',
      talentId: 5,
      amount: '1000',
      talentShareRate: 60,
      agencyShareRate: 40,
      status: 'settled',
      settlementId: 99,
    } as unknown as BrandOrderEntity;
    orderRepo.findOne.mockResolvedValueOnce(order);
    await expect(
      run(() => svc.settleBrandOrder(3, { talentShareRate: 60 } as any)),
    ).rejects.toMatchObject({ code: 'BRAND_ORDER_ALREADY_SETTLED' });
  });

  it('setBrandOrderStatus 非法流转 → INVALID_STATUS_TRANSITION', async () => {
    orderRepo.findOne.mockResolvedValueOnce({
      id: 3,
      tenantId: '1',
      status: 'pending',
    });
    await expect(run(() => svc.setBrandOrderStatus(3, 'settled' as any))).rejects.toMatchObject({
      code: 'INVALID_STATUS_TRANSITION',
    });
  });
});
