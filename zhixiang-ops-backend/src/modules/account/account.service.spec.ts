import 'dotenv/config';
import { QueryFailedError } from 'typeorm';
import { AccountService } from './account.service';
import { TenantContext } from '../../tenant/tenant-context';
import { decryptSecret } from '../../shared/crypto';
import { AccountEntity } from './account.entity';
import { AccountGroupEntity } from './account-group.entity';
import { AccountHealthEventEntity } from './account-health-event.entity';
import { AccountEnvEntity } from './account-env.entity';
import { AccountRiskLogEntity } from './account-risk-log.entity';

/**
 * AccountService 单元测试（规划 §4-B / B-core）。
 * 直接实例化 `new AccountService(mockAccountRepo, mockEventRepo)`（不走 Nest DI）。
 * 所有业务调用用 `TenantContext.run({ traceId, tenantId }, () => svc.xxx())` 包裹，
 * 否则 service 内的 requireTenantId 会抛 TENANT_REQUIRED。
 */

// —— 测试辅助：构造一个"真的" QueryFailedError 实例（满足 err instanceof QueryFailedError）——
function makeDuplicateError(): QueryFailedError {
  const err = new QueryFailedError('', [], new Error('Duplicate entry')) as QueryFailedError & {
    code: string;
  };
  (err as { code: string }).code = 'ER_DUP_ENTRY';
  return err;
}

// —— 测试辅助：构造一个链式 QueryBuilder mock ——
function buildQueryBuilder() {
  return {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getMany: jest.fn().mockResolvedValue([]),
  };
}

describe('AccountService', () => {
  let svc: AccountService;
  let mockAccountRepo: any;
  let mockEventRepo: any;
  let mockEnvRepo: any;
  let mockRiskRepo: any;
  let mockGroupRepo: any;
  let qb: ReturnType<typeof buildQueryBuilder>;

  beforeEach(() => {
    qb = buildQueryBuilder();
    mockEventRepo = {
      create: jest.fn((e: Partial<AccountHealthEventEntity>) => e),
      save: jest.fn().mockResolvedValue({}),
    };
    mockAccountRepo = {
      create: jest.fn((e: Partial<AccountEntity>) => e),
      save: jest.fn(async (e: AccountEntity) => e),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      softDelete: jest.fn().mockResolvedValue({}),
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };
    mockEnvRepo = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((e: Partial<AccountEnvEntity>) => ({ ...e })),
      save: jest.fn(async (e: any) => e),
    };
    mockRiskRepo = {
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((e: Partial<AccountRiskLogEntity>) => ({ ...e })),
      save: jest.fn(async (e: any) => e),
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };
    mockGroupRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      create: jest.fn((e: Partial<AccountGroupEntity>) => ({ ...e })),
      save: jest.fn(async (e: any) => e),
      count: jest.fn().mockResolvedValue(0),
      softDelete: jest.fn().mockResolvedValue({}),
    };
    svc = new AccountService(
      mockAccountRepo,
      mockEventRepo,
      mockEnvRepo,
      mockRiskRepo,
      mockGroupRepo,
    );
  });

  describe('create', () => {
    it('未传 accessToken → status=unsigned 且不绑定 token', async () => {
      const dto = {
        platform: 'douyin',
        platformAccountId: 'pa-1',
        nickname: '未授权号',
      } as any;

      const result = await TenantContext.run({ traceId: 't1', tenantId: 'tn-1' }, () =>
        svc.create(dto),
      );

      // 入库对象不应有 tokenEnc
      const saved = mockAccountRepo.save.mock.calls[0][0] as AccountEntity;
      expect(saved.tokenEnc).toBeUndefined();
      expect(saved.status).toBe('unsigned');
      // 视图对象也不含敏感字段
      expect(result).not.toHaveProperty('tokenEnc');
      expect(result).not.toHaveProperty('refreshTokenEnc');
      expect(result.status).toBe('unsigned');
    });

    it('传入 accessToken → 加密存储且能被 decryptSecret 还原，status 由有效期推导', async () => {
      const plain = 'secret-access-token-xyz';
      const dto = {
        platform: 'douyin',
        platformAccountId: 'pa-2',
        nickname: '已授权号',
        accessToken: plain,
        refreshToken: 'secret-refresh-token',
        tokenExpireAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(), // 未来 7 天
      } as any;

      const result = await TenantContext.run({ traceId: 't2', tenantId: 'tn-1' }, () =>
        svc.create(dto),
      );

      const saved = mockAccountRepo.save.mock.calls[0][0] as AccountEntity;
      // 1) tokenEnc 不是明文
      expect(saved.tokenEnc).toBeDefined();
      expect(saved.tokenEnc).not.toBe(plain);
      // 2) 能被 decryptSecret 还原
      expect(decryptSecret(saved.tokenEnc as string)).toBe(plain);
      // refreshToken 同样加密
      expect(saved.refreshTokenEnc).toBeDefined();
      expect(decryptSecret(saved.refreshTokenEnc as string)).toBe('secret-refresh-token');
      // 3) 未来有效期 → status 推导为 normal
      expect(saved.status).toBe('normal');
      // 视图对象剥离敏感字段
      expect(result).not.toHaveProperty('tokenEnc');
      // 首次绑定 Token 应记录 connected 事件
      const eventCall = mockEventRepo.create.mock.calls.find(
        (c: any[]) => c[0].eventType === 'connected',
      );
      expect(eventCall).toBeDefined();
    });

    it('重复 (tenantId, platform, platformAccountId) → 抛 ACCOUNT_DUPLICATE', async () => {
      mockAccountRepo.save.mockRejectedValueOnce(makeDuplicateError());
      const dto = {
        platform: 'douyin',
        platformAccountId: 'pa-dup',
        accessToken: 'tok',
      } as any;

      await expect(
        TenantContext.run({ traceId: 't3', tenantId: 'tn-1' }, () => svc.create(dto)),
      ).rejects.toMatchObject({ code: 'ACCOUNT_DUPLICATE' });
    });
  });

  describe('findOne', () => {
    it('不存在 → 抛 ACCOUNT_NOT_FOUND', async () => {
      mockAccountRepo.findOne.mockResolvedValueOnce(undefined);
      await expect(
        TenantContext.run({ traceId: 't4', tenantId: 'tn-1' }, () => svc.findOne(999)),
      ).rejects.toMatchObject({ code: 'ACCOUNT_NOT_FOUND' });
    });

    it('存在 → 返回对象且不暴露 tokenEnc/refreshTokenEnc', async () => {
      mockAccountRepo.findOne.mockResolvedValueOnce({
        id: 1,
        tenantId: 'tn-1',
        platform: 'douyin',
        platformAccountId: 'pa-1',
        nickname: 'n',
        status: 'normal',
        tokenEnc: 'enc-xxx',
        refreshTokenEnc: 'renc-yyy',
      });

      const result = await TenantContext.run({ traceId: 't5', tenantId: 'tn-1' }, () =>
        svc.findOne(1),
      );

      expect(result.id).toBe(1);
      expect(result).not.toHaveProperty('tokenEnc');
      expect(result).not.toHaveProperty('refreshTokenEnc');
    });
  });

  describe('findAll', () => {
    it('返回标准分页结构 {list,total,page,pageSize} 且调用 createQueryBuilder', async () => {
      const rows = [
        { id: 1, tenantId: 'tn-1', platform: 'douyin', status: 'normal' },
        { id: 2, tenantId: 'tn-1', platform: 'kuaishou', status: 'unsigned' },
      ] as AccountEntity[];
      qb.getManyAndCount.mockResolvedValueOnce([rows, 42]);

      const result = await TenantContext.run({ traceId: 't6', tenantId: 'tn-1' }, () =>
        svc.findAll({ page: 1, pageSize: 20 } as any),
      );

      expect(mockAccountRepo.createQueryBuilder).toHaveBeenCalled();
      expect(result).toHaveProperty('list');
      expect(result).toHaveProperty('total', 42);
      expect(result).toHaveProperty('page', 1);
      expect(result).toHaveProperty('pageSize', 20);
      expect(result.list).toHaveLength(2);
      // 列表项同样剥离敏感字段
      expect(result.list[0]).not.toHaveProperty('tokenEnc');
    });
  });

  describe('update', () => {
    it('局部更新生效；传入 accessToken 后重新加密且可还原', async () => {
      const oldEnc = 'old-enc';
      mockAccountRepo.findOne.mockResolvedValueOnce({
        id: 1,
        tenantId: 'tn-1',
        platform: 'douyin',
        platformAccountId: 'pa-1',
        nickname: '旧昵称',
        status: 'normal',
        tokenEnc: oldEnc,
      });

      const newPlain = 'new-access-token';
      const dto = {
        nickname: '新昵称',
        accessToken: newPlain,
        tokenExpireAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      } as any;

      const result = await TenantContext.run({ traceId: 't7', tenantId: 'tn-1' }, () =>
        svc.update(1, dto),
      );

      const saved = mockAccountRepo.save.mock.calls[0][0] as AccountEntity;
      expect(saved.nickname).toBe('新昵称'); // 局部更新生效
      expect(saved.tokenEnc).toBeDefined();
      expect(saved.tokenEnc).not.toBe(oldEnc); // 已重新加密
      expect(decryptSecret(saved.tokenEnc as string)).toBe(newPlain); // 可还原
      expect(result.nickname).toBe('新昵称');
    });
  });

  describe('remove', () => {
    it('调用 softDelete（按 id+tenantId 软删除）', async () => {
      mockAccountRepo.findOne.mockResolvedValueOnce({
        id: 5,
        tenantId: 'tn-1',
        platform: 'douyin',
        status: 'normal',
      });

      const result = await TenantContext.run({ traceId: 't8', tenantId: 'tn-1' }, () =>
        svc.remove(5),
      );

      expect(mockAccountRepo.softDelete).toHaveBeenCalledWith({ id: 5, tenantId: 'tn-1' });
      expect(result).toEqual({ id: 5 });
    });
  });

  describe('refreshToken', () => {
    it('传入新 token 后 status 回正(normal) 并记录 token_refreshed 健康事件', async () => {
      mockAccountRepo.findOne.mockResolvedValueOnce({
        id: 1,
        tenantId: 'tn-1',
        platform: 'douyin',
        platformAccountId: 'pa-1',
        status: 'unsigned',
        tokenEnc: 'stale',
      });

      const newPlain = 'refreshed-token';
      const dto = {
        accessToken: newPlain,
        tokenExpireAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      } as any;

      const result = await TenantContext.run({ traceId: 't9', tenantId: 'tn-1' }, () =>
        svc.refreshToken(1, dto),
      );

      const saved = mockAccountRepo.save.mock.calls[0][0] as AccountEntity;
      expect(saved.status).toBe('normal'); // 回正
      expect(decryptSecret(saved.tokenEnc as string)).toBe(newPlain);
      expect(result.status).toBe('normal');
      // 记录健康事件
      const eventCall = mockEventRepo.create.mock.calls.find(
        (c: any[]) => c[0].eventType === 'token_refreshed',
      );
      expect(eventCall).toBeDefined();
      expect(eventCall[0].prevStatus).toBe('unsigned');
      expect(eventCall[0].nextStatus).toBe('normal');
    });
  });

  describe('healthSummary', () => {
    it('按 status/platform 聚合计数，unsigned 账号进入 unsignedAccounts', async () => {
      const rows = [
        { id: 1, tenantId: 'tn-1', platform: 'douyin', status: 'normal' },
        { id: 2, tenantId: 'tn-1', platform: 'douyin', status: 'unsigned' },
        { id: 3, tenantId: 'tn-1', platform: 'kuaishou', status: 'unsigned' },
      ] as AccountEntity[];
      mockAccountRepo.find.mockResolvedValue(rows);

      const summary = await TenantContext.run({ traceId: 't10', tenantId: 'tn-1' }, () =>
        svc.healthSummary(),
      );

      expect(summary.total).toBe(3);
      expect(summary.byStatus).toEqual({ normal: 1, unsigned: 2 });
      expect(summary.byPlatform).toEqual({ douyin: 2, kuaishou: 1 });
      expect(summary.unsignedAccounts).toHaveLength(2);
      expect(summary.unsignedAccounts.map((a) => a.id).sort()).toEqual([2, 3]);
    });

    it('跨租户隔离：不同 tenantId 下 healthSummary 互不干扰', async () => {
      mockAccountRepo.find.mockImplementation(async (opts: any) => {
        if (opts.where.tenantId === 'tn-1') {
          return [
            { id: 1, tenantId: 'tn-1', platform: 'douyin', status: 'normal' },
            { id: 2, tenantId: 'tn-1', platform: 'kuaishou', status: 'unsigned' },
          ] as AccountEntity[];
        }
        // tn-2 的数据
        return [
          { id: 10, tenantId: 'tn-2', platform: 'bilibili', status: 'normal' },
        ] as AccountEntity[];
      });

      const s1 = await TenantContext.run({ traceId: 't11a', tenantId: 'tn-1' }, () =>
        svc.healthSummary(),
      );
      const s2 = await TenantContext.run({ traceId: 't11b', tenantId: 'tn-2' }, () =>
        svc.healthSummary(),
      );

      expect(s1.total).toBe(2);
      expect(s1.unsignedAccounts.map((a) => a.id)).toEqual([2]);
      expect(s2.total).toBe(1);
      expect(s2.byPlatform).toEqual({ bilibili: 1 });
      expect(s2.unsignedAccounts).toHaveLength(0);
      // find 的 where 必须带正确的 tenantId
      const tenantIds = mockAccountRepo.find.mock.calls.map((c: any[]) => c[0].where.tenantId);
      expect(tenantIds).toContain('tn-1');
      expect(tenantIds).toContain('tn-2');
    });
  });

  describe('reconcileHealth（定时巡检）', () => {
    it('Token 已过期且非 unsigned/banned → 标记 unsigned 并记录 token_expired 事件', async () => {
      const expiredAcc = {
        id: 1,
        tenantId: 'tn-1',
        platform: 'douyin',
        status: 'normal',
        tokenExpireAt: new Date(Date.now() - 60 * 1000), // 1 分钟前过期
      } as AccountEntity;
      const nearAcc: AccountEntity[] = []; // 无临期账号
      qb.getMany.mockResolvedValueOnce([expiredAcc]).mockResolvedValueOnce(nearAcc);

      await TenantContext.run({ traceId: 't12', tenantId: 'tn-1' }, () => svc.reconcileHealth());

      // 该账号状态被改为 unsigned
      expect(expiredAcc.status).toBe('unsigned');
      // 调用了 save
      expect(mockAccountRepo.save).toHaveBeenCalledWith(expiredAcc);
      // 记录了 token_expired 事件
      const eventCall = mockEventRepo.create.mock.calls.find(
        (c: any[]) => c[0].eventType === 'token_expired',
      );
      expect(eventCall).toBeDefined();
      expect(eventCall[0].prevStatus).toBe('normal');
      expect(eventCall[0].nextStatus).toBe('unsigned');
    });

    it('Token 临期(≤3天)且为 normal → 标记 warning', async () => {
      const nearAcc = {
        id: 2,
        tenantId: 'tn-1',
        platform: 'kuaishou',
        status: 'normal',
        tokenExpireAt: new Date(Date.now() + 2 * 24 * 3600 * 1000), // 2 天后（≤3天）
      } as AccountEntity;
      qb.getMany
        .mockResolvedValueOnce([]) // 无过期账号
        .mockResolvedValueOnce([nearAcc]);

      await TenantContext.run({ traceId: 't13', tenantId: 'tn-1' }, () => svc.reconcileHealth());

      expect(nearAcc.status).toBe('warning');
      expect(mockAccountRepo.save).toHaveBeenCalledWith(nearAcc);
    });
  });

  describe('跨租户隔离（验证点 10）', () => {
    it('findOne / findAll 的查询 where 携带正确 tenantId', async () => {
      mockAccountRepo.findOne.mockResolvedValueOnce({
        id: 1,
        tenantId: 'tn-1',
        platform: 'douyin',
        status: 'normal',
      });
      qb.getManyAndCount.mockResolvedValueOnce([[], 0]);

      // tn-1 上下文
      await TenantContext.run({ traceId: 't14a', tenantId: 'tn-1' }, () => svc.findOne(1));
      await TenantContext.run({ traceId: 't14a2', tenantId: 'tn-1' }, () =>
        svc.findAll({ page: 1, pageSize: 20 } as any),
      );

      expect(mockAccountRepo.findOne.mock.calls[0][0].where).toEqual({
        id: 1,
        tenantId: 'tn-1',
      });
      expect(qb.where).toHaveBeenCalledWith('a.tenant_id = :tenantId', { tenantId: 'tn-1' });

      // 重置，切换 tn-2
      jest.clearAllMocks();
      qb = buildQueryBuilder();
      mockAccountRepo.createQueryBuilder.mockReturnValue(qb);
      mockAccountRepo.findOne.mockResolvedValueOnce({
        id: 2,
        tenantId: 'tn-2',
        platform: 'douyin',
        status: 'normal',
      });
      qb.getManyAndCount.mockResolvedValueOnce([[], 0]);

      await TenantContext.run({ traceId: 't14b', tenantId: 'tn-2' }, () => svc.findOne(2));
      await TenantContext.run({ traceId: 't14b2', tenantId: 'tn-2' }, () =>
        svc.findAll({ page: 1, pageSize: 20 } as any),
      );

      expect(mockAccountRepo.findOne.mock.calls[0][0].where).toEqual({
        id: 2,
        tenantId: 'tn-2',
      });
      expect(qb.where).toHaveBeenCalledWith('a.tenant_id = :tenantId', { tenantId: 'tn-2' });
    });
  });

  describe('B-advanced：环境隔离 / 防关联', () => {
    it('configureEnv 账号不存在 → ACCOUNT_NOT_FOUND', async () => {
      mockAccountRepo.findOne.mockResolvedValueOnce(undefined);
      await expect(
        TenantContext.run({ traceId: 'b1', tenantId: 'tn-1' }, () =>
          svc.configureEnv(1, { ip: '1.2.3.4' }),
        ),
      ).rejects.toMatchObject({ code: 'ACCOUNT_NOT_FOUND' });
    });

    it('configureEnv 首次配置（不存在则新建并保存）', async () => {
      mockAccountRepo.findOne.mockResolvedValueOnce({ id: 1, tenantId: 'tn-1' });
      mockEnvRepo.findOne.mockResolvedValueOnce(undefined);

      const result = await TenantContext.run({ traceId: 'b2', tenantId: 'tn-1' }, () =>
        svc.configureEnv(1, {
          ip: '1.2.3.4',
          envIsolated: true,
          isolateProvider: 'proxy_ip',
        }),
      );

      expect(mockEnvRepo.create).toHaveBeenCalled();
      expect(mockEnvRepo.save).toHaveBeenCalled();
      expect(result.accountId).toBe(1);
      expect(result.ip).toBe('1.2.3.4');
      expect(result.envIsolated).toBe(true);
    });

    it('getRiskLogs 返回标准 {list,total}（走 createQueryBuilder）', async () => {
      const rows = [
        {
          id: 1,
          tenantId: 'tn-1',
          accountId: 1,
          riskType: '关联',
          score: 80,
        } as AccountRiskLogEntity,
      ];
      qb.getManyAndCount.mockResolvedValueOnce([rows, 1]);

      const r = await TenantContext.run({ traceId: 'b3', tenantId: 'tn-1' }, () =>
        svc.getRiskLogs(),
      );
      expect(mockRiskRepo.createQueryBuilder).toHaveBeenCalled();
      expect(r.total).toBe(1);
      expect(r.list).toHaveLength(1);
    });

    it('evaluateAntiAssociate：共享 1 项(IP)=40 不写日志；共享 3 项=100 写关联风险日志', async () => {
      mockEnvRepo.find.mockResolvedValueOnce([
        { id: 1, tenantId: 'tn-1', accountId: 11, ip: '9.9.9.9' } as AccountEnvEntity,
        { id: 2, tenantId: 'tn-1', accountId: 12, ip: '9.9.9.9' } as AccountEnvEntity,
      ]);

      const r = await TenantContext.run({ traceId: 'b4', tenantId: 'tn-1' }, () =>
        svc.evaluateAntiAssociate(),
      );
      expect(r.pairs).toHaveLength(1);
      expect(r.pairs[0].shared).toEqual(['ip']);
      expect(r.pairs[0].score).toBe(40);
      expect(r.riskAccounts).toEqual([]); // 40<60 未达高风险阈值，不计入风险账号
      expect(mockRiskRepo.save).not.toHaveBeenCalled();

      mockRiskRepo.save.mockClear();
      mockEnvRepo.find.mockResolvedValueOnce([
        {
          id: 1,
          tenantId: 'tn-1',
          accountId: 11,
          ip: '9.9.9.9',
          device: 'd1',
          fingerprint: 'f1',
        } as AccountEnvEntity,
        {
          id: 2,
          tenantId: 'tn-1',
          accountId: 12,
          ip: '9.9.9.9',
          device: 'd1',
          fingerprint: 'f1',
        } as AccountEnvEntity,
      ]);
      const r2 = await TenantContext.run({ traceId: 'b5', tenantId: 'tn-1' }, () =>
        svc.evaluateAntiAssociate(),
      );
      expect(r2.pairs[0].score).toBe(100);
      expect(mockRiskRepo.save).toHaveBeenCalledTimes(2);
    });
  });

  describe('B-advanced：账号分组', () => {
    it('createGroup 创建分组并返回实体', async () => {
      const result = await TenantContext.run({ traceId: 'g1', tenantId: 'tn-1' }, () =>
        svc.createGroup({ name: '主号阵地', platform: 'douyin', sortOrder: 1 }),
      );
      expect(mockGroupRepo.create).toHaveBeenCalled();
      expect(result.name).toBe('主号阵地');
      expect(result.platform).toBe('douyin');
      expect(result.sortOrder).toBe(1);
    });

    it('createGroup 同租户重名 → ACCOUNT_GROUP_DUPLICATE', async () => {
      mockGroupRepo.save.mockRejectedValueOnce(makeDuplicateError());
      await expect(
        TenantContext.run({ traceId: 'g2', tenantId: 'tn-1' }, () =>
          svc.createGroup({ name: '主号阵地' }),
        ),
      ).rejects.toMatchObject({ code: 'ACCOUNT_GROUP_DUPLICATE' });
    });

    it('listGroups 返回分组列表并附各组账号数', async () => {
      mockGroupRepo.find.mockResolvedValueOnce([
        { id: 1, tenantId: 'tn-1', name: 'A 组', platform: 'douyin', sortOrder: 1 },
        { id: 2, tenantId: 'tn-1', name: 'B 组', sortOrder: 2 },
      ] as AccountGroupEntity[]);
      mockAccountRepo.find.mockResolvedValueOnce([
        { id: 10, tenantId: 'tn-1', platform: 'douyin', status: 'normal', groupId: 1 },
        { id: 11, tenantId: 'tn-1', platform: 'douyin', status: 'normal', groupId: 1 },
        { id: 12, tenantId: 'tn-1', platform: 'kuaishou', status: 'unsigned', groupId: 2 },
      ] as AccountEntity[]);

      const r = await TenantContext.run({ traceId: 'g3', tenantId: 'tn-1' }, () =>
        svc.listGroups(),
      );
      expect(r.total).toBe(2);
      expect(r.list[0].accountCount).toBe(2);
      expect(r.list[1].accountCount).toBe(1);
    });

    it('listGroupAccounts 组不存在 → ACCOUNT_GROUP_NOT_FOUND', async () => {
      mockGroupRepo.findOne.mockResolvedValueOnce(undefined);
      await expect(
        TenantContext.run({ traceId: 'g4', tenantId: 'tn-1' }, () => svc.listGroupAccounts(99)),
      ).rejects.toMatchObject({ code: 'ACCOUNT_GROUP_NOT_FOUND' });
    });

    it('listGroupAccounts 返回组内账号（含健康分兜底，剥离敏感字段）', async () => {
      mockGroupRepo.findOne.mockResolvedValueOnce({ id: 1, tenantId: 'tn-1', name: 'A 组' });
      mockAccountRepo.find.mockResolvedValueOnce([
        {
          id: 10,
          tenantId: 'tn-1',
          platform: 'douyin',
          status: 'normal',
          groupId: 1,
          tokenEnc: 'enc',
        },
        {
          id: 11,
          tenantId: 'tn-1',
          platform: 'douyin',
          status: 'warning',
          groupId: 1,
          healthScore: 66,
        },
      ] as AccountEntity[]);

      const r = await TenantContext.run({ traceId: 'g5', tenantId: 'tn-1' }, () =>
        svc.listGroupAccounts(1),
      );
      expect(r).toHaveLength(2);
      // 未沉淀 → 按 normal 兜底 90
      expect(r[0].healthScore).toBe(90);
      // 已沉淀 → 原样
      expect(r[1].healthScore).toBe(66);
      expect(r[0]).not.toHaveProperty('tokenEnc');
    });

    it('removeGroup 组内仍有账号 → ACCOUNT_GROUP_IN_USE；空组可删', async () => {
      mockGroupRepo.findOne.mockResolvedValueOnce({ id: 1, tenantId: 'tn-1', name: 'A 组' });
      mockAccountRepo.count.mockResolvedValueOnce(3);
      await expect(
        TenantContext.run({ traceId: 'g6', tenantId: 'tn-1' }, () => svc.removeGroup(1)),
      ).rejects.toMatchObject({ code: 'ACCOUNT_GROUP_IN_USE' });

      mockAccountRepo.count.mockResolvedValueOnce(0);
      mockGroupRepo.findOne.mockResolvedValueOnce({ id: 1, tenantId: 'tn-1', name: 'A 组' });
      const r = await TenantContext.run({ traceId: 'g7', tenantId: 'tn-1' }, () =>
        svc.removeGroup(1),
      );
      expect(mockGroupRepo.softDelete).toHaveBeenCalledWith({ id: 1, tenantId: 'tn-1' });
      expect(r).toEqual({ id: 1 });
    });

    it('update 指派 groupId：组不存在 → ACCOUNT_GROUP_NOT_FOUND；persona 生效', async () => {
      mockAccountRepo.findOne.mockResolvedValueOnce({
        id: 1,
        tenantId: 'tn-1',
        platform: 'douyin',
        status: 'normal',
      });
      mockGroupRepo.findOne.mockResolvedValueOnce(undefined);
      await expect(
        TenantContext.run({ traceId: 'g8', tenantId: 'tn-1' }, () =>
          svc.update(1, { groupId: 9 } as any),
        ),
      ).rejects.toMatchObject({ code: 'ACCOUNT_GROUP_NOT_FOUND' });

      mockAccountRepo.findOne.mockResolvedValueOnce({
        id: 1,
        tenantId: 'tn-1',
        platform: 'douyin',
        status: 'normal',
      });
      mockGroupRepo.findOne.mockResolvedValueOnce({ id: 5, tenantId: 'tn-1', name: 'A 组' });
      const r = await TenantContext.run({ traceId: 'g9', tenantId: 'tn-1' }, () =>
        svc.update(1, { groupId: 5, persona: '知识科普' } as any),
      );
      expect(mockGroupRepo.findOne).toHaveBeenCalledWith({ where: { id: 5, tenantId: 'tn-1' } });
      const saved = mockAccountRepo.save.mock.calls[0][0] as AccountEntity;
      expect(saved.groupId).toBe(5);
      expect(saved.persona).toBe('知识科普');
      expect(r.persona).toBe('知识科普');
    });
  });

  describe('matrix（矩阵视图）', () => {
    it('按分组归档账号；未分组与组失效账号归入 ungrouped；健康分兜底', async () => {
      mockGroupRepo.find.mockResolvedValueOnce([
        { id: 1, tenantId: 'tn-1', name: 'A 组', platform: 'douyin', sortOrder: 1 },
      ] as AccountGroupEntity[]);
      mockAccountRepo.find.mockResolvedValueOnce([
        { id: 1, tenantId: 'tn-1', platform: 'douyin', status: 'normal', groupId: 1 },
        { id: 2, tenantId: 'tn-1', platform: 'kuaishou', status: 'unsigned', groupId: 1 },
        { id: 3, tenantId: 'tn-1', platform: 'bilibili', status: 'warning' },
        { id: 4, tenantId: 'tn-1', platform: 'douyin', status: 'banned', groupId: 777 },
      ] as AccountEntity[]);

      const m = await TenantContext.run({ traceId: 'm1', tenantId: 'tn-1' }, () => svc.matrix());

      expect(m.total).toBe(4);
      expect(m.byStatus).toEqual({ normal: 1, unsigned: 1, warning: 1, banned: 1 });
      expect(m.groups).toHaveLength(1);
      expect(m.groups[0].accountCount).toBe(2);
      expect(m.groups[0].accounts.map((a) => a.id).sort()).toEqual([1, 2]);
      expect(m.groups[0].accounts[0].healthScore).toBe(90); // normal 兜底
      expect(m.ungrouped.map((a) => a.id).sort()).toEqual([3, 4]); // 未分组 + 组失效
      expect(m.ungrouped[0]).not.toHaveProperty('tokenEnc');
      // 查询均按租户隔离
      expect(mockGroupRepo.find.mock.calls[0][0].where).toEqual({ tenantId: 'tn-1' });
      expect(mockAccountRepo.find.mock.calls[0][0].where).toEqual({ tenantId: 'tn-1' });
    });
  });

  describe('健康分沉淀', () => {
    it('update 变更状态 → 依据风险日志数扣分并落库（近30天窗口）', async () => {
      mockAccountRepo.findOne.mockResolvedValueOnce({
        id: 1,
        tenantId: 'tn-1',
        platform: 'douyin',
        status: 'normal',
      });
      mockRiskRepo.find.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]); // 2 条近期风险日志

      await TenantContext.run({ traceId: 'h1', tenantId: 'tn-1' }, () =>
        svc.update(1, { status: 'warning' } as any),
      );
      const saved = mockAccountRepo.save.mock.calls[0][0] as AccountEntity;
      // warning 基准 70 - 2×5
      expect(saved.healthScore).toBe(60);
      // 窗口查询携带租户/账号/时间条件
      const query = mockRiskRepo.find.mock.calls[0][0];
      expect(query.where.tenantId).toBe('tn-1');
      expect(query.where.accountId).toBe(1);
      expect(query.where.loggedAt).toBeDefined();
    });

    it('risk 日志超过扣分下限 → 健康分不小于 0', async () => {
      mockAccountRepo.findOne.mockResolvedValueOnce({
        id: 1,
        tenantId: 'tn-1',
        platform: 'douyin',
        status: 'risk',
      });
      mockRiskRepo.find.mockResolvedValueOnce(new Array(30));
      await TenantContext.run({ traceId: 'h2', tenantId: 'tn-1' }, () =>
        svc.update(1, { remark: 'x' } as any),
      );
      const saved = mockAccountRepo.save.mock.calls[0][0] as AccountEntity;
      // risk 基准 45 - 150 → 下限 0
      expect(saved.healthScore).toBe(0);
    });

    it('reconcileHealth 掉签 → 健康分同步为 unsigned 基准 30 并落库', async () => {
      const expiredAcc = {
        id: 1,
        tenantId: 'tn-1',
        platform: 'douyin',
        status: 'normal',
        tokenExpireAt: new Date(Date.now() - 60 * 1000),
      } as AccountEntity;
      qb.getMany.mockResolvedValueOnce([expiredAcc]).mockResolvedValueOnce([]);
      await TenantContext.run({ traceId: 'h3', tenantId: 'tn-1' }, () => svc.reconcileHealth());
      expect(expiredAcc.status).toBe('unsigned');
      expect(expiredAcc.healthScore).toBe(30);
    });
  });
});
