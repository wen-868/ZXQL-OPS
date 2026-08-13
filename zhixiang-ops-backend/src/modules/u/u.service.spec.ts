import 'dotenv/config';
import { PrivateService } from './private.service';
import { TenantContext } from '../../tenant/tenant-context';
import { FansProfileEntity } from './fans-profile.entity';
import { PrivateGroupEntity } from './private-group.entity';

/**
 * U 粉丝与私域运营 单元测试（规划「U 私域」详细设计）。
 * 合规边界（§11②）：仅存聚合分布与公开字段，不落个体隐私。
 * PrivateService 直接实例化（不走 Nest DI）；业务调用用 TenantContext.run 包裹。
 */

describe('PrivateService', () => {
  let svc: PrivateService;
  let mockFansRepo: any;
  let mockGroupRepo: any;
  let mockAudit: any;

  beforeEach(() => {
    mockAudit = { record: jest.fn().mockResolvedValue({}) };
    mockGroupRepo = {
      create: jest.fn((e: any) => e),
      save: jest.fn(async (e: any) => ({ ...e, id: e.id ?? 1 })),
      findOne: jest.fn(),
    };
    mockFansRepo = {
      create: jest.fn((e: any) => e),
      save: jest.fn(async (e: any) => ({ ...e, id: e.id ?? 1 })),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
    };
    svc = new PrivateService(mockFansRepo, mockGroupRepo, mockAudit);
  });

  describe('upsertFans 画像（合规边界）', () => {
    it('新建粉丝画像：仅公开ID/聚合字段 + 入库带 tenantId + 落审计', async () => {
      mockFansRepo.findOne.mockResolvedValue(null);
      const v = await TenantContext.run({ traceId: 'u1', tenantId: 'tn-1' }, () =>
        svc.upsertFans({
          platform: 'douyin',
          publicId: 'pub_123',
          level: 'vip',
          interactAgg: { avgWatchSec: 30 },
          tags: ['高活跃'],
          source: 'public',
        } as any),
      );
      const persisted = mockFansRepo.save.mock.calls[0][0] as FansProfileEntity;
      expect(persisted.tenantId).toBe('tn-1');
      expect(persisted.publicId).toBe('pub_123');
      // 合规：不存在精准地理位置/个体隐私字段
      expect((persisted as any).geoLocation).toBeUndefined();
      expect((persisted as any).realName).toBeUndefined();
      expect(v.source).toBe('public');
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'upsert_fans_profile', module: 'private' }),
      );
    });

    it('已存在则更新分层标签', async () => {
      mockFansRepo.findOne.mockResolvedValue({
        id: 7,
        tenantId: 'tn-1',
        platform: 'douyin',
        publicId: 'pub_123',
        tags: ['旧'],
      });
      const v = await TenantContext.run({ traceId: 'u2', tenantId: 'tn-1' }, () =>
        svc.upsertFans({ platform: 'douyin', publicId: 'pub_123', tags: ['新'] } as any),
      );
      expect(v.tags).toEqual(['新']);
    });
  });

  describe('tagFans 分层打标', () => {
    it('打标 + 落审计', async () => {
      mockFansRepo.findOne.mockResolvedValue({ id: 7, tenantId: 'tn-1', tags: [] });
      const v = await TenantContext.run({ traceId: 'u3', tenantId: 'tn-1' }, () =>
        svc.tagFans({ id: 7, tags: ['高价值'] } as any),
      );
      expect(v.tags).toEqual(['高价值']);
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'tag_fans_profile', module: 'private' }),
      );
    });

    it('粉丝不存在 → FANS_PROFILE_NOT_FOUND', async () => {
      mockFansRepo.findOne.mockResolvedValue(null);
      await expect(
        TenantContext.run({ traceId: 'u4', tenantId: 'tn-1' }, () =>
          svc.tagFans({ id: 99, tags: ['x'] } as any),
        ),
      ).rejects.toMatchObject({ code: 'FANS_PROFILE_NOT_FOUND' });
    });
  });

  describe('listFans 画像列表（聚合分布）', () => {
    it('按租户过滤 + 可选 platform', async () => {
      mockFansRepo.find.mockResolvedValue([{ id: 1, tenantId: 'tn-1', platform: 'douyin' }]);
      await TenantContext.run({ traceId: 'u5', tenantId: 'tn-1' }, () => svc.listFans('douyin'));
      expect(mockFansRepo.find).toHaveBeenCalledWith({
        where: { tenantId: 'tn-1', platform: 'douyin' },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('createGroup 建私域群（合规：仅公开ID）', () => {
    it('入库带 tenantId + 落审计', async () => {
      await TenantContext.run({ traceId: 'u6', tenantId: 'tn-1' }, () =>
        svc.createGroup({ name: 'VIP群', type: 'wecom', members: ['pub_1', 'pub_2'] } as any),
      );
      const persisted = mockGroupRepo.save.mock.calls[0][0] as PrivateGroupEntity;
      expect(persisted.tenantId).toBe('tn-1');
      expect(persisted.members).toEqual(['pub_1', 'pub_2']);
      expect(persisted.type).toBe('wecom');
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'create_private_group', module: 'private' }),
      );
    });
  });

  describe('pushGroup 私域触达', () => {
    it('返回触达人数 + 落审计', async () => {
      mockGroupRepo.findOne.mockResolvedValue({
        id: 3,
        tenantId: 'tn-1',
        members: ['a', 'b', 'c'],
      });
      const r = await TenantContext.run({ traceId: 'u7', tenantId: 'tn-1' }, () =>
        svc.pushGroup(3),
      );
      expect(r.pushed).toBe(3);
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'push_private_group', module: 'private' }),
      );
    });

    it('群不存在 → PRIVATE_GROUP_NOT_FOUND', async () => {
      mockGroupRepo.findOne.mockResolvedValue(null);
      await expect(
        TenantContext.run({ traceId: 'u8', tenantId: 'tn-1' }, () => svc.pushGroup(99)),
      ).rejects.toMatchObject({ code: 'PRIVATE_GROUP_NOT_FOUND' });
    });
  });

  describe('distribute 推客分销（→ W 复购佣金）', () => {
    it('返回分级数 + 佣金比例 + 落审计', async () => {
      const r = await TenantContext.run({ traceId: 'u9', tenantId: 'tn-1' }, () =>
        svc.distribute({ publicIds: ['a', 'b'], planName: '618分销', tierCommission: 0.1 } as any),
      );
      expect(r.tiers).toBe(2);
      expect(r.commission).toBe(0.1);
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'fans_distribute', module: 'private' }),
      );
    });
  });

  describe('repurchase 复购 CRM（→ W 复购佣金）', () => {
    it('返回公开ID与金额 + 落审计', async () => {
      const r = await TenantContext.run({ traceId: 'u10', tenantId: 'tn-1' }, () =>
        svc.repurchase({ publicId: 'pub_1', amount: 199 } as any),
      );
      expect(r.publicId).toBe('pub_1');
      expect(r.amount).toBe(199);
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'fans_repurchase', module: 'private' }),
      );
    });
  });
});
