import 'dotenv/config';
import { AdService } from './ad.service';
import { TenantContext } from '../../tenant/tenant-context';
import { AdAccountEntity } from './ad-account.entity';
import { AdCampaignEntity } from './ad-campaign.entity';

/**
 * S 投流管理 单元测试（规划「S 投流」详细设计）。
 * AdService 直接实例化（不走 Nest DI）；业务调用用 TenantContext.run 包裹。
 */

describe('AdService', () => {
  let svc: AdService;
  let mockAccountRepo: any;
  let mockCampaignRepo: any;
  let mockMetricRepo: any;
  let mockSkill: any;
  let mockAudit: any;

  beforeEach(() => {
    mockAudit = { record: jest.fn().mockResolvedValue({}) };
    mockSkill = { generateText: jest.fn().mockResolvedValue('建议：提高出价 5%') };
    mockMetricRepo = {
      create: jest.fn((e: any) => e),
      save: jest.fn(async (e: any) => ({ ...e, id: e.id ?? 1 })),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
    };
    mockCampaignRepo = {
      create: jest.fn((e: any) => e),
      save: jest.fn(async (e: any) => ({ ...e, id: e.id ?? 1 })),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
    };
    mockAccountRepo = {
      create: jest.fn((e: any) => e),
      save: jest.fn(async (e: any) => ({ ...e, id: e.id ?? 1 })),
      findOne: jest.fn(),
    };
    svc = new AdService(mockAccountRepo, mockCampaignRepo, mockMetricRepo, mockSkill, mockAudit);
  });

  describe('createAccount 绑账户', () => {
    it('入库带 tenantId + 落审计', async () => {
      const v = await TenantContext.run({ traceId: 's1', tenantId: 'tn-1' }, () =>
        svc.createAccount({ platform: 'douyin', type: 'qianchuan' } as any),
      );
      const persisted = mockAccountRepo.save.mock.calls[0][0] as AdAccountEntity;
      expect(persisted.tenantId).toBe('tn-1');
      expect(persisted.platform).toBe('douyin');
      expect(persisted.status).toBe('active');
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'bind_ad_account', module: 'ad' }),
      );
      expect(v.id).toBeDefined();
    });
  });

  describe('createCampaign 建计划', () => {
    it('生成 ad 类 attribution_id + 校验账户存在 + 落审计', async () => {
      mockAccountRepo.findOne.mockResolvedValue({ id: 3, tenantId: 'tn-1' });
      await TenantContext.run({ traceId: 's2', tenantId: 'tn-1' }, () =>
        svc.createCampaign({
          accountId: 3,
          name: '618大促',
          planType: 'standard',
          budget: 1000,
        } as any),
      );
      const persisted = mockCampaignRepo.save.mock.calls[0][0] as AdCampaignEntity;
      expect(persisted.tenantId).toBe('tn-1');
      expect(persisted.accountId).toBe(3);
      expect(persisted.status).toBe('draft');
      expect(persisted.attributionId).toMatch(/^attr_tn-1_ad_[0-9a-f]{32}$/);
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'create_ad_campaign', module: 'ad' }),
      );
    });

    it('投放账户不存在 → AD_ACCOUNT_NOT_FOUND', async () => {
      mockAccountRepo.findOne.mockResolvedValue(null);
      await expect(
        TenantContext.run({ traceId: 's3', tenantId: 'tn-1' }, () =>
          svc.createCampaign({ accountId: 99, name: 'x', planType: 'standard' } as any),
        ),
      ).rejects.toMatchObject({ code: 'AD_ACCOUNT_NOT_FOUND' });
    });
  });

  describe('getMetrics 实时监控', () => {
    it('最新指标或 null', async () => {
      mockCampaignRepo.findOne.mockResolvedValue({ id: 5, tenantId: 'tn-1' });
      mockMetricRepo.findOne.mockResolvedValue(null);
      const r = await TenantContext.run({ traceId: 's4', tenantId: 'tn-1' }, () =>
        svc.getMetrics(5),
      );
      expect(r).toBeNull();
    });

    it('计划不存在 → AD_CAMPAIGN_NOT_FOUND', async () => {
      mockCampaignRepo.findOne.mockResolvedValue(null);
      await expect(
        TenantContext.run({ traceId: 's5', tenantId: 'tn-1' }, () => svc.getMetrics(5)),
      ).rejects.toMatchObject({ code: 'AD_CAMPAIGN_NOT_FOUND' });
    });
  });

  describe('smartBid 智能出价', () => {
    it('调 SkillGateway 产出建议 + 落审计', async () => {
      mockCampaignRepo.findOne.mockResolvedValue({
        id: 5,
        tenantId: 'tn-1',
        name: '618大促',
        roi: 2.1,
        budget: 1000,
      });
      const r = await TenantContext.run({ traceId: 's6', tenantId: 'tn-1' }, () =>
        svc.smartBid({ campaignId: 5, targetRoi: 3 } as any),
      );
      expect(r.suggestion).toBe('建议：提高出价 5%');
      expect(mockSkill.generateText).toHaveBeenCalled();
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ad_smart_bid', module: 'ad' }),
      );
    });
  });

  describe('review 复盘', () => {
    it('聚合指标 + 透传 attribution_id', async () => {
      mockCampaignRepo.findOne.mockResolvedValue({
        id: 5,
        tenantId: 'tn-1',
        attributionId: 'attr_tn-1_ad_abc',
        spend: 500,
      });
      mockMetricRepo.find.mockResolvedValue([
        { cost: 100, conversions: 2, impressions: 0, clicks: 0, roi: 0 },
        { cost: 200, conversions: 3, impressions: 0, clicks: 0, roi: 0 },
      ]);
      const r = await TenantContext.run({ traceId: 's7', tenantId: 'tn-1' }, () => svc.review(5));
      expect(r.attributionId).toBe('attr_tn-1_ad_abc');
      expect(r.totalCost).toBe(300);
      expect(r.totalConversions).toBe(5);
      expect(r.metricsCount).toBe(2);
    });
  });

  describe('reportMetric 指标上报', () => {
    it('回写 campaign spend', async () => {
      mockCampaignRepo.findOne.mockResolvedValue({ id: 5, tenantId: 'tn-1', spend: 0, roi: 0 });
      await TenantContext.run({ traceId: 's8', tenantId: 'tn-1' }, () =>
        svc.reportMetric({ campaignId: 5, cost: 100, conversions: 2 } as any),
      );
      const savedCampaign = mockCampaignRepo.save.mock.calls[0][0];
      expect(Number(savedCampaign.spend)).toBe(100);
    });
  });
});
