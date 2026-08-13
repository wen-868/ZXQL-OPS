import 'dotenv/config';
import { LiveService } from './live.service';
import { TenantContext } from '../../tenant/tenant-context';
import { LiveRoomEntity } from './live-room.entity';

/**
 * K 直播中心 单元测试（规划「K 直播中心」详细设计）。
 * LiveService 直接实例化（不走 Nest DI）；业务调用用 TenantContext.run 包裹。
 */

describe('LiveService', () => {
  let svc: LiveService;
  let mockRoomRepo: any;
  let mockDigitalHumanRepo: any;
  let mockDanmuRepo: any;
  let mockAiReplyRepo: any;
  let mockStatRepo: any;
  let mockAccountRepo: any;
  let mockGroupRepo: any;
  let mockEventRepo: any;
  let mockProductRepo: any;
  let mockSkill: any;
  let mockAudit: any;

  beforeEach(() => {
    mockAudit = { record: jest.fn().mockResolvedValue({}) };
    mockSkill = { generateText: jest.fn().mockResolvedValue('AI回复') };
    mockStatRepo = {
      create: jest.fn((e: any) => e),
      save: jest.fn(async (e: any) => ({ ...e, id: e.id ?? 1 })),
      findOne: jest.fn(),
    };
    mockAiReplyRepo = {
      create: jest.fn((e: any) => e),
      save: jest.fn(async (e: any) => ({ ...e, id: e.id ?? 1 })),
    };
    mockDanmuRepo = {
      create: jest.fn((e: any) => e),
      save: jest.fn(async (e: any) => ({ ...e, id: e.id ?? 1 })),
    };
    mockDigitalHumanRepo = {
      create: jest.fn((e: any) => e),
      save: jest.fn(async (e: any) => ({ ...e, id: e.id ?? 1 })),
    };
    mockProductRepo = { count: jest.fn().mockResolvedValue(0) };
    mockAccountRepo = {
      findOne: jest.fn(),
      save: jest.fn(async (e: any) => e),
    };
    mockGroupRepo = { findOne: jest.fn() };
    mockEventRepo = {
      create: jest.fn((e: any) => e),
      save: jest.fn(async (e: any) => e),
    };
    mockRoomRepo = {
      create: jest.fn((e: any) => e),
      save: jest.fn(async (e: any) => ({ ...e, id: e.id ?? 1 })),
      findOne: jest.fn(),
    };
    svc = new LiveService(
      mockRoomRepo,
      mockDigitalHumanRepo,
      mockDanmuRepo,
      mockAiReplyRepo,
      mockStatRepo,
      mockAccountRepo,
      mockGroupRepo,
      mockEventRepo,
      mockProductRepo,
      mockSkill,
      mockAudit,
    );
  });

  describe('createRoom 建直播间', () => {
    it('绑定 B 账号 + 生成 live 类 attribution_id + 落审计', async () => {
      mockAccountRepo.findOne.mockResolvedValue({ id: 10, tenantId: 'tn-1' });
      await TenantContext.run({ traceId: 'k1', tenantId: 'tn-1' }, () =>
        svc.createRoom({
          type: 'real',
          platform: 'douyin',
          accountId: 10,
          title: '测试直播',
        } as any),
      );
      const persisted = mockRoomRepo.save.mock.calls[0][0] as LiveRoomEntity;
      expect(persisted.tenantId).toBe('tn-1');
      expect(persisted.accountId).toBe(10);
      expect(persisted.status).toBe('created');
      expect(persisted.attributionId).toMatch(/^attr_tn-1_live_[0-9a-f]{32}$/);
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'create_live_room', module: 'live' }),
      );
    });

    it('B 账号不存在 → LIVE_ACCOUNT_NOT_FOUND', async () => {
      mockAccountRepo.findOne.mockResolvedValue(null);
      await expect(
        TenantContext.run({ traceId: 'k2', tenantId: 'tn-1' }, () =>
          svc.createRoom({ type: 'real', platform: 'douyin', accountId: 99 } as any),
        ),
      ).rejects.toMatchObject({ code: 'LIVE_ACCOUNT_NOT_FOUND' });
    });

    it('挂载的 R 商品缺失 → LIVE_PRODUCT_NOT_FOUND', async () => {
      mockAccountRepo.findOne.mockResolvedValue({ id: 10, tenantId: 'tn-1' });
      mockProductRepo.count.mockResolvedValue(1); // 需要 2 个只匹配 1
      await expect(
        TenantContext.run({ traceId: 'k3', tenantId: 'tn-1' }, () =>
          svc.createRoom({
            type: 'real',
            platform: 'douyin',
            accountId: 10,
            productIds: [1, 2],
          } as any),
        ),
      ).rejects.toMatchObject({ code: 'LIVE_PRODUCT_NOT_FOUND' });
    });
  });

  describe('状态机 开/停', () => {
    it('created → live → ended', async () => {
      const room = { id: 5, tenantId: 'tn-1', status: 'created', attributionId: 'a' };
      mockRoomRepo.findOne.mockResolvedValue(room);
      const started = await TenantContext.run({ traceId: 'k4', tenantId: 'tn-1' }, () =>
        svc.startRoom(5),
      );
      expect(started.status).toBe('live');
      expect(mockRoomRepo.findOne).toHaveBeenCalledWith({ where: { id: 5, tenantId: 'tn-1' } });

      mockRoomRepo.findOne.mockResolvedValue({
        id: 5,
        tenantId: 'tn-1',
        status: 'live',
        attributionId: 'a',
      });
      const ended = await TenantContext.run({ traceId: 'k5', tenantId: 'tn-1' }, () =>
        svc.endRoom(5),
      );
      expect(ended.status).toBe('ended');
    });

    it('非 created 开播 → LIVE_ROOM_NOT_CREATED', async () => {
      mockRoomRepo.findOne.mockResolvedValue({
        id: 5,
        tenantId: 'tn-1',
        status: 'live',
        attributionId: 'a',
      });
      await expect(
        TenantContext.run({ traceId: 'k6', tenantId: 'tn-1' }, () => svc.startRoom(5)),
      ).rejects.toMatchObject({ code: 'LIVE_ROOM_NOT_CREATED' });
    });

    it('非 live 结束 → LIVE_ROOM_NOT_LIVE', async () => {
      mockRoomRepo.findOne.mockResolvedValue({
        id: 5,
        tenantId: 'tn-1',
        status: 'created',
        attributionId: 'a',
      });
      await expect(
        TenantContext.run({ traceId: 'k7', tenantId: 'tn-1' }, () => svc.endRoom(5)),
      ).rejects.toMatchObject({ code: 'LIVE_ROOM_NOT_LIVE' });
    });
  });

  describe('弹幕 AI 应答闭环', () => {
    it('auto 模式 → 调 SkillGateway 生成回复 + 落弹幕 + 落审计', async () => {
      mockRoomRepo.findOne.mockResolvedValue({ id: 5, tenantId: 'tn-1', attributionId: 'a' });
      const r = await TenantContext.run({ traceId: 'k8', tenantId: 'tn-1' }, () =>
        svc.danmuAiReply({ roomId: 5, question: '多少钱' } as any),
      );
      expect(r.status).toBe('auto');
      expect(r.answer).toBe('AI回复');
      expect(mockSkill.generateText).toHaveBeenCalled();
      expect(mockDanmuRepo.save).toHaveBeenCalled();
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'live_danmu_ai_reply', module: 'live' }),
      );
    });

    it('pending 模式 → 不调 SkillGateway，仅落待确认记录', async () => {
      mockRoomRepo.findOne.mockResolvedValue({ id: 5, tenantId: 'tn-1', attributionId: 'a' });
      const r = await TenantContext.run({ traceId: 'k9', tenantId: 'tn-1' }, () =>
        svc.danmuAiReply({ roomId: 5, question: '多少钱', status: 'pending' } as any),
      );
      expect(r.status).toBe('pending');
      expect(r.answer).toBeNull();
      expect(mockSkill.generateText).not.toHaveBeenCalled();
    });
  });

  describe('stats 上报', () => {
    it('透传直播间 attribution_id', async () => {
      mockRoomRepo.findOne.mockResolvedValue({
        id: 5,
        tenantId: 'tn-1',
        attributionId: 'attr_tn-1_live_abc',
      });
      const s = await TenantContext.run({ traceId: 'k10', tenantId: 'tn-1' }, () =>
        svc.reportStat({ roomId: 5, onlineCount: 100, gmv: 500 } as any),
      );
      expect(s.attributionId).toBe('attr_tn-1_live_abc');
      expect(s.onlineCount).toBe(100);
      expect(s.gmv).toBe(500);
    });
  });

  describe('数字人管理', () => {
    it('createDigitalHuman → 入库带 tenantId', async () => {
      await TenantContext.run({ traceId: 'k11', tenantId: 'tn-1' }, () =>
        svc.createDigitalHuman({ name: '小智' } as any),
      );
      const persisted = mockDigitalHumanRepo.save.mock.calls[0][0];
      expect(persisted.tenantId).toBe('tn-1');
      expect(persisted.name).toBe('小智');
    });
  });

  describe('B 矩阵联动（P1-4）', () => {
    it('createRoom：账号带分组 → view 含分组名与健康分兜底', async () => {
      mockAccountRepo.findOne.mockResolvedValue({
        id: 10,
        tenantId: 'tn-1',
        groupId: 1,
        status: 'normal',
        healthScore: null,
      });
      mockGroupRepo.findOne.mockResolvedValue({ id: 1, tenantId: 'tn-1', name: '主号阵地' });

      const room = await TenantContext.run({ traceId: 'k12', tenantId: 'tn-1' }, () =>
        svc.createRoom({ type: 'real', platform: 'douyin', accountId: 10 } as any),
      );

      expect(room.accountGroupId).toBe(1);
      expect(room.accountGroupName).toBe('主号阵地');
      expect(room.accountHealthScore).toBe(90); // normal 未沉淀 → 按状态兜底
      expect(mockGroupRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1, tenantId: 'tn-1' },
      });
    });

    it('createRoom：未分组账号 → 联动字段为 null，且不查分组', async () => {
      mockAccountRepo.findOne.mockResolvedValue({
        id: 11,
        tenantId: 'tn-1',
        status: 'normal',
      });

      const room = await TenantContext.run({ traceId: 'k13', tenantId: 'tn-1' }, () =>
        svc.createRoom({ type: 'real', platform: 'douyin', accountId: 11 } as any),
      );

      expect(room.accountGroupId).toBeNull();
      expect(room.accountGroupName).toBeNull();
      expect(room.accountHealthScore).toBe(90); // 未沉淀仍按状态兜底
      expect(mockGroupRepo.findOne).not.toHaveBeenCalled();
    });

    it('endRoom：回写账号 lastActiveAt + live_ended 健康事件（不改账号状态）', async () => {
      mockRoomRepo.findOne.mockResolvedValue({
        id: 5,
        tenantId: 'tn-1',
        status: 'live',
        accountId: 10,
        attributionId: 'a',
      });
      const account: any = { id: 10, tenantId: 'tn-1', status: 'normal' };
      mockAccountRepo.findOne.mockResolvedValue(account);

      const ended = await TenantContext.run({ traceId: 'k14', tenantId: 'tn-1' }, () =>
        svc.endRoom(5),
      );

      expect(ended.status).toBe('ended');
      expect(account.lastActiveAt).toBeInstanceOf(Date); // 活跃回写
      expect(mockAccountRepo.save).toHaveBeenCalledWith(account);
      const event = mockEventRepo.create.mock.calls[0][0];
      expect(event.eventType).toBe('live_ended');
      expect(event.tenantId).toBe('tn-1');
      expect(event.prevStatus).toBe('normal'); // 状态未变
      expect(event.nextStatus).toBe('normal');
      expect(mockEventRepo.save).toHaveBeenCalled();
    });

    it('endRoom：账号已删 → 回写静默跳过，直播主链路不受影响', async () => {
      mockRoomRepo.findOne.mockResolvedValue({
        id: 5,
        tenantId: 'tn-1',
        status: 'live',
        accountId: 10,
        attributionId: 'a',
      });
      mockAccountRepo.findOne.mockResolvedValue(null);

      const ended = await TenantContext.run({ traceId: 'k15', tenantId: 'tn-1' }, () =>
        svc.endRoom(5),
      );

      expect(ended.status).toBe('ended');
      expect(mockEventRepo.save).not.toHaveBeenCalled();
      expect(mockAccountRepo.save).not.toHaveBeenCalled();
    });

    it('getRoom：返回账号联动信息（分组名 + 已沉淀健康分）', async () => {
      mockRoomRepo.findOne.mockResolvedValue({
        id: 5,
        tenantId: 'tn-1',
        status: 'live',
        accountId: 10,
        attributionId: 'a',
      });
      mockAccountRepo.findOne.mockResolvedValue({
        id: 10,
        tenantId: 'tn-1',
        groupId: 2,
        status: 'warning',
        healthScore: 66,
      });
      mockGroupRepo.findOne.mockResolvedValue({ id: 2, tenantId: 'tn-1', name: '活动组' });

      const room = await TenantContext.run({ traceId: 'k16', tenantId: 'tn-1' }, () =>
        svc.getRoom(5),
      );

      expect(room.accountGroupName).toBe('活动组');
      expect(room.accountHealthScore).toBe(66); // 已沉淀原样展示
      expect(mockAccountRepo.findOne).toHaveBeenCalledWith({
        where: { id: 10, tenantId: 'tn-1' },
      });
    });
  });
});
