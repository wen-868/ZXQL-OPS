import { Repository } from 'typeorm';
import { PublishService } from './publish.service';
import { PublishTaskEntity } from './publish.entity';
import { PublishStatus } from './publish.types';
import { ScriptEntity } from '../script/script.entity';
import {
  ComplianceHit,
  ComplianceLevel,
  ComplianceRisk,
  ScriptStatus,
} from '../script/script.types';
import { AccountEntity } from '../account/account.entity';
import { VideoEntity } from '../h/video.entity';
import { AccountIdentity, AccountStage, AccountStatus, Platform } from '../account/account.types';
import { TenantContext } from '../../tenant/tenant-context';
import { CreatePublishDto } from './dto/create-publish.dto';
import { BatchPublishDto } from './dto/batch-publish.dto';
import { DouyinClientService } from '../../integration/douyin-client.service';

/**
 * PublishService（I 发布与分发）单元测试（规划 §4-I / R6 任务卡）。
 * 直接实例化 `new PublishService(mockPublishRepo, mockScriptRepo, mockAccountRepo, mockDouyin)`（不走 Nest DI）。
 * 所有业务调用用 `TenantContext.run({ traceId, tenantId }, () => svc.xxx())` 包裹，
 * 否则 service 内的 requireTenantId 会抛 TENANT_REQUIRED。
 */

const TENANT = 'tn-1';

/** 测试辅助：findOne mock 调用参数里的 where 形状（强类型，避免 any） */
type FindWhere = { id?: number; tenantId?: string; status?: string };
type FindOneCall = { where?: FindWhere };

/** 测试辅助：Repository 的最小强类型 mock（属性为 jest.Mock 实例，避免 any 与 unbound-method） */
type MockRepo<T> = {
  create: jest.Mock<T, [Partial<T>]>;
  save: jest.Mock<Promise<T>, [Partial<T>]>;
  findOne: jest.Mock<Promise<T | null>, [unknown?]>;
  createQueryBuilder: jest.Mock<unknown, []>;
};

// —— 测试辅助：合规风险 ——
function complianceRisk(level: ComplianceLevel, hits: ComplianceHit[] = []): ComplianceRisk {
  return { hits, level, checkedAt: '2025-01-01T00:00:00.000Z' };
}

// —— 测试辅助：可发布脚本 ——
type ScriptPartial = Omit<Partial<ScriptEntity>, 'status' | 'complianceRisk'> & {
  status?: ScriptStatus;
  complianceRisk?: ComplianceRisk | null;
};
function makePublishableScript(partial: ScriptPartial = {}): ScriptEntity {
  return {
    id: partial.id ?? 1,
    tenantId: partial.tenantId ?? TENANT,
    topicId: partial.topicId ?? 1,
    attributionId: partial.attributionId ?? 'attr_t1_content_abc',
    title: partial.title ?? '脚本A',
    content: partial.content ?? '内容',
    hook: partial.hook ?? '钩子',
    hookEmotion: partial.hookEmotion ?? '好奇',
    spokenTrack: partial.spokenTrack ?? [],
    subtitleTrack: partial.subtitleTrack ?? [],
    templateId: partial.templateId ?? null,
    version: partial.version ?? 1,
    parentVersionId: partial.parentVersionId ?? null,
    status: partial.status ?? ScriptStatus.Approved,
    complianceRisk: partial.complianceRisk ?? complianceRisk('none'),
    promptVersion: partial.promptVersion ?? 'v1',
    modelUsed: partial.modelUsed ?? 'ollama/llama3',
    createdAt: partial.createdAt ?? new Date('2025-01-01T00:00:00Z'),
    updatedAt: partial.updatedAt ?? new Date('2025-01-01T00:00:00Z'),
  } as ScriptEntity;
}

// —— 测试辅助：账号（status/platform 等接受原始字符串以匹配业务码）——
function makeAccount(
  partial: Partial<AccountEntity> & {
    status?: AccountStatus;
    platform?: Platform;
    identity?: AccountIdentity;
    stage?: AccountStage;
  } = {},
): AccountEntity {
  return {
    id: partial.id ?? 1,
    tenantId: partial.tenantId ?? TENANT,
    platform: partial.platform ?? 'douyin',
    platformAccountId: partial.platformAccountId ?? 'pd_1',
    nickname: partial.nickname ?? '账号1',
    identity: partial.identity ?? 'matrix',
    stage: partial.stage ?? 'nurturing',
    status: partial.status ?? 'normal',
    fansCount: partial.fansCount ?? 0,
    followCount: partial.followCount ?? 0,
    likeCount: partial.likeCount ?? 0,
    createdAt: partial.createdAt ?? new Date('2025-01-01T00:00:00Z'),
    updatedAt: partial.updatedAt ?? new Date('2025-01-01T00:00:00Z'),
  } as AccountEntity;
}

// —— 测试辅助：发布任务（已 published）——
function makePublishedTask(partial: Partial<PublishTaskEntity> = {}): PublishTaskEntity {
  return {
    id: partial.id ?? 100,
    tenantId: partial.tenantId ?? TENANT,
    scriptId: partial.scriptId ?? 1,
    accountId: partial.accountId ?? 1,
    platform: partial.platform ?? 'douyin',
    attributionId: partial.attributionId ?? 'attr_t1_content_abc',
    videoId: partial.videoId ?? null,
    scheduledAt: partial.scheduledAt ?? null,
    status: partial.status ?? PublishStatus.Published,
    retryCount: partial.retryCount ?? 0,
    extPostId: partial.extPostId ?? `pub_${TENANT}_1_1`,
    cartProductId: partial.cartProductId ?? null,
    cartClicks: partial.cartClicks ?? 0,
    orderConv: partial.orderConv ?? 0,
    publishedAt: partial.publishedAt ?? new Date('2025-01-01T00:00:00Z'),
    createdAt: partial.createdAt ?? new Date('2025-01-01T00:00:00Z'),
    updatedAt: partial.updatedAt ?? new Date('2025-01-01T00:00:00Z'),
  } as PublishTaskEntity;
}

describe('PublishService', () => {
  let svc: PublishService;
  let mockPublishRepo: MockRepo<PublishTaskEntity>;
  let mockScriptRepo: MockRepo<ScriptEntity>;
  let mockAccountRepo: MockRepo<AccountEntity>;
  let mockVideoRepo: MockRepo<VideoEntity>;

  beforeEach(() => {
    mockPublishRepo = {
      create: jest.fn((e: Partial<PublishTaskEntity>) => ({ id: 0, ...e }) as PublishTaskEntity),
      save: jest.fn((e: Partial<PublishTaskEntity>) =>
        Promise.resolve({ id: 0, ...e } as PublishTaskEntity),
      ),
      findOne: jest.fn<Promise<PublishTaskEntity | null>, [unknown?]>(),
      createQueryBuilder: jest.fn<unknown, []>(),
    };
    mockScriptRepo = {
      create: jest.fn((e: Partial<ScriptEntity>) => e as ScriptEntity),
      save: jest.fn((e: Partial<ScriptEntity>) => Promise.resolve(e as ScriptEntity)),
      findOne: jest.fn<Promise<ScriptEntity | null>, [unknown?]>(),
      createQueryBuilder: jest.fn<unknown, []>(),
    };
    mockAccountRepo = {
      create: jest.fn((e: Partial<AccountEntity>) => e as AccountEntity),
      save: jest.fn((e: Partial<AccountEntity>) => Promise.resolve(e as AccountEntity)),
      findOne: jest.fn<Promise<AccountEntity | null>, [unknown?]>(),
      createQueryBuilder: jest.fn<unknown, []>(),
    };
    mockVideoRepo = {
      create: jest.fn((e: Partial<VideoEntity>) => e as VideoEntity),
      save: jest.fn((e: Partial<VideoEntity>) => Promise.resolve(e as VideoEntity)),
      findOne: jest.fn<Promise<VideoEntity | null>, [unknown?]>(),
      createQueryBuilder: jest.fn<unknown, []>(),
    };
    svc = new PublishService(
      mockPublishRepo as unknown as Repository<PublishTaskEntity>,
      mockScriptRepo as unknown as Repository<ScriptEntity>,
      mockAccountRepo as unknown as Repository<AccountEntity>,
      mockVideoRepo as unknown as Repository<VideoEntity>,
      { isConfigured: () => false } as DouyinClientService,
    );
  });

  // —— 验收点 1：publish 正常（一键分发）——
  describe('验收点1 publish 正常分发', () => {
    it('scriptRepo 返回可发布脚本 + 两账号均 douyin → create+save 2 次；tasks 透传 attributionId/platform/extPostId/publishedAt', async () => {
      const script = makePublishableScript({ id: 1, attributionId: 'attr_t1_content_abc' });
      const acc1 = makeAccount({ id: 1, platform: 'douyin' });
      const acc2 = makeAccount({ id: 2, platform: 'douyin' });

      // createTask 顺序：幂等 findOne → scriptRepo.findOne → accountRepo.findone
      mockPublishRepo.findOne.mockResolvedValueOnce(null); // 幂等（account1）
      mockScriptRepo.findOne.mockResolvedValueOnce(script);
      mockAccountRepo.findOne.mockResolvedValueOnce(acc1);
      mockPublishRepo.findOne.mockResolvedValueOnce(null); // 幂等（account2）
      mockScriptRepo.findOne.mockResolvedValueOnce(script);
      mockAccountRepo.findOne.mockResolvedValueOnce(acc2);

      // save 返回带 id 的实体
      mockPublishRepo.save
        .mockResolvedValueOnce({ id: 10, extPostId: `pub_${TENANT}_1_1` } as PublishTaskEntity)
        .mockResolvedValueOnce({ id: 11, extPostId: `pub_${TENANT}_1_2` } as PublishTaskEntity);

      const dto: CreatePublishDto = { scriptId: 1, accountIds: [1, 2] };
      const result = await TenantContext.run({ traceId: 't1', tenantId: TENANT }, () =>
        svc.publish(dto),
      );

      expect(mockPublishRepo.create).toHaveBeenCalledTimes(2);
      expect(mockPublishRepo.save).toHaveBeenCalledTimes(2);
      expect(result.taskIds).toEqual([10, 11]);
      expect(result.traceId).toBe('t1');

      const createdCalls = mockPublishRepo.create.mock.calls;
      expect(createdCalls[0][0]).toMatchObject({
        scriptId: 1,
        accountId: 1,
        platform: 'douyin',
        attributionId: 'attr_t1_content_abc',
        status: PublishStatus.Published,
        extPostId: `pub_${TENANT}_1_1`,
      });
      expect(createdCalls[0][0].publishedAt).toBeInstanceOf(Date);
      expect(createdCalls[1][0]).toMatchObject({
        accountId: 2,
        platform: 'douyin',
        attributionId: 'attr_t1_content_abc',
        extPostId: `pub_${TENANT}_2_1`,
      });
      expect(createdCalls[1][0].publishedAt).toBeInstanceOf(Date);
    });
  });

  // —— 验收点 2：publish 脚本不存在 ——
  describe('验收点2 publish 脚本不存在', () => {
    it('scriptRepo.findOne 返回 undefined → 抛 SCRIPT_NOT_FOUND，accountRepo.findOne 未被调用', async () => {
      mockPublishRepo.findOne.mockResolvedValueOnce(null); // 幂等
      mockScriptRepo.findOne.mockResolvedValueOnce(null);

      const dto: CreatePublishDto = { scriptId: 999, accountIds: [1] };
      await expect(
        TenantContext.run({ traceId: 't2', tenantId: TENANT }, () => svc.publish(dto)),
      ).rejects.toMatchObject({ code: 'SCRIPT_NOT_FOUND' });

      expect(mockAccountRepo.findOne).not.toHaveBeenCalled();
      expect(mockPublishRepo.save).not.toHaveBeenCalled();
    });
  });

  // —— 验收点 3：publish 脚本未达可发布状态 ——
  describe('验收点3 publish 脚本未达可发布状态', () => {
    it.each([ScriptStatus.Draft, ScriptStatus.Reviewing])(
      "status='%s' 且 level='none' → 抛 SCRIPT_NOT_PUBLISHABLE",
      async (status) => {
        const script = makePublishableScript({
          id: 1,
          status,
          complianceRisk: complianceRisk('none'),
        });
        mockPublishRepo.findOne.mockResolvedValueOnce(null); // 幂等
        mockScriptRepo.findOne.mockResolvedValueOnce(script);

        const dto: CreatePublishDto = { scriptId: 1, accountIds: [1] };
        await expect(
          TenantContext.run({ traceId: 't3', tenantId: TENANT }, () => svc.publish(dto)),
        ).rejects.toMatchObject({ code: 'SCRIPT_NOT_PUBLISHABLE' });

        expect(mockAccountRepo.findOne).not.toHaveBeenCalled();
        expect(mockPublishRepo.save).not.toHaveBeenCalled();
      },
    );
  });

  // —— 验收点 4：publish 高危合规拦截 ——
  describe('验收点4 publish 高危合规拦截', () => {
    it('complianceRisk.level=high → 抛 COMPLIANCE_BLOCKED；accountRepo.findOne 与 save 未被调用', async () => {
      const script = makePublishableScript({
        id: 1,
        status: ScriptStatus.Approved,
        complianceRisk: complianceRisk('high', [{ word: '国家级', position: 0, level: 'high' }]),
      });
      mockPublishRepo.findOne.mockResolvedValueOnce(null); // 幂等
      mockScriptRepo.findOne.mockResolvedValueOnce(script);

      const dto: CreatePublishDto = { scriptId: 1, accountIds: [1] };
      await expect(
        TenantContext.run({ traceId: 't4', tenantId: TENANT }, () => svc.publish(dto)),
      ).rejects.toMatchObject({ code: 'COMPLIANCE_BLOCKED' });

      expect(mockAccountRepo.findOne).not.toHaveBeenCalled();
      expect(mockPublishRepo.save).not.toHaveBeenCalled();
    });
  });

  // —— 验收点 5：publish 发布账号不存在 ——
  describe('验收点5 publish 发布账号不存在', () => {
    it('scriptRepo 返回可发布脚本；accountRepo.findOne(accountIds[0]) 返回 undefined → 抛 PUBLISH_ACCOUNT_NOT_FOUND', async () => {
      const script = makePublishableScript({ id: 1 });
      mockPublishRepo.findOne.mockResolvedValueOnce(null); // 幂等
      mockScriptRepo.findOne.mockResolvedValueOnce(script);
      mockAccountRepo.findOne.mockResolvedValueOnce(null);

      const dto: CreatePublishDto = { scriptId: 1, accountIds: [1] };
      await expect(
        TenantContext.run({ traceId: 't5', tenantId: TENANT }, () => svc.publish(dto)),
      ).rejects.toMatchObject({ code: 'PUBLISH_ACCOUNT_NOT_FOUND' });

      expect(mockPublishRepo.save).not.toHaveBeenCalled();
    });
  });

  // —— 验收点 6：publish platform 不一致 ——
  describe('验收点6 publish platform 不一致', () => {
    it("dto.platform='xhs' ≠ account.platform='douyin' → 抛 PUBLISH_PLATFORM_MISMATCH", async () => {
      const script = makePublishableScript({ id: 1 });
      const acc = makeAccount({ id: 1, platform: 'douyin' });
      mockPublishRepo.findOne.mockResolvedValueOnce(null); // 幂等
      mockScriptRepo.findOne.mockResolvedValueOnce(script);
      mockAccountRepo.findOne.mockResolvedValueOnce(acc);

      const dto: CreatePublishDto = { scriptId: 1, accountIds: [1], platform: 'xhs' };
      await expect(
        TenantContext.run({ traceId: 't6', tenantId: TENANT }, () => svc.publish(dto)),
      ).rejects.toMatchObject({ code: 'PUBLISH_PLATFORM_MISMATCH' });

      expect(mockPublishRepo.save).not.toHaveBeenCalled();
    });
  });

  // —— 验收点 7：publish 幂等 ——
  describe('验收点7 publish 幂等', () => {
    it('相同 tenant+scriptId+accountId 已 published → 二次 createTask 返回原任务，save 不被再次调用', async () => {
      const script = makePublishableScript({ id: 1, attributionId: 'attr_t1_content_abc' });
      const acc = makeAccount({ id: 1, platform: 'douyin' });

      // 第一次调用 createTask（新建）：幂等返回 undefined → 新建，save 返回 id=100
      mockPublishRepo.findOne.mockResolvedValueOnce(null); // 幂等
      mockScriptRepo.findOne.mockResolvedValueOnce(script);
      mockAccountRepo.findOne.mockResolvedValueOnce(acc);
      mockPublishRepo.save.mockResolvedValueOnce({ id: 100 } as PublishTaskEntity);

      const first = await TenantContext.run({ traceId: 't7a', tenantId: TENANT }, () =>
        svc.publish({ scriptId: 1, accountIds: [1] }),
      );
      expect(first.taskIds).toEqual([100]);
      expect(mockPublishRepo.save).toHaveBeenCalledTimes(1);

      // 第二次调用 createTask（相同 key）：幂等 findOne 返回已存在的 published 任务 → 直接返回，不 save
      const existing = makePublishedTask({
        id: 100,
        scriptId: 1,
        accountId: 1,
        attributionId: 'attr_t1_content_abc',
      });
      mockPublishRepo.findOne.mockResolvedValueOnce(existing); // 幂等返回已存在

      const second = await TenantContext.run({ traceId: 't7b', tenantId: TENANT }, () =>
        svc.publish({ scriptId: 1, accountIds: [1] }),
      );
      expect(second.taskIds).toEqual([100]);
      expect(mockPublishRepo.save).toHaveBeenCalledTimes(1); // 仍为 1 次，未新增
    });
  });

  // —— 验收点 8：batchPublish 正常 ——
  describe('验收点8 batchPublish 正常', () => {
    it('tasks=[{scriptId:1,accountIds:[1]},{scriptId:2,accountIds:[3]}] → save 2 次，返回 2 个 taskIds', async () => {
      const script1 = makePublishableScript({ id: 1, attributionId: 'attr_t1_content_aaa' });
      const script2 = makePublishableScript({ id: 2, attributionId: 'attr_t1_content_bbb' });
      const acc1 = makeAccount({ id: 1, platform: 'douyin' });
      const acc3 = makeAccount({ id: 3, platform: 'douyin' });

      // task1: 幂等 → script1 → acc1
      mockPublishRepo.findOne.mockResolvedValueOnce(null);
      mockScriptRepo.findOne.mockResolvedValueOnce(script1);
      mockAccountRepo.findOne.mockResolvedValueOnce(acc1);
      // task2: 幂等 → script2 → acc3
      mockPublishRepo.findOne.mockResolvedValueOnce(null);
      mockScriptRepo.findOne.mockResolvedValueOnce(script2);
      mockAccountRepo.findOne.mockResolvedValueOnce(acc3);

      mockPublishRepo.save
        .mockResolvedValueOnce({ id: 20 } as PublishTaskEntity)
        .mockResolvedValueOnce({ id: 21 } as PublishTaskEntity);

      const dto: BatchPublishDto = {
        tasks: [
          { scriptId: 1, accountIds: [1] },
          { scriptId: 2, accountIds: [3] },
        ],
      };
      const result = await TenantContext.run({ traceId: 't8', tenantId: TENANT }, () =>
        svc.batchPublish(dto),
      );

      expect(mockPublishRepo.save).toHaveBeenCalledTimes(2);
      expect(result.taskIds).toHaveLength(2);
      expect(result.taskIds).toEqual([20, 21]);
    });
  });

  // —— 验收点 9：getPublish 不存在/存在 ——
  describe('验收点9 getPublish', () => {
    it('不存在 → 抛 PUBLISH_NOT_FOUND', async () => {
      mockPublishRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        TenantContext.run({ traceId: 't9a', tenantId: TENANT }, () => svc.getPublish(999)),
      ).rejects.toMatchObject({ code: 'PUBLISH_NOT_FOUND' });
    });

    it('存在 → 返回实体', async () => {
      const task = makePublishedTask({ id: 7 });
      mockPublishRepo.findOne.mockResolvedValueOnce(task);
      const result = await TenantContext.run({ traceId: 't9b', tenantId: TENANT }, () =>
        svc.getPublish(7),
      );
      expect(result.id).toBe(7);
      expect(mockPublishRepo.findOne.mock.calls[0][0]).toEqual({
        where: { id: 7, tenantId: TENANT },
      });
    });
  });

  // —— 验收点 10：getFunnel ——
  describe('验收点10 getFunnel', () => {
    it('cartClicks=0,orderConv=0 → conversionRate=0', async () => {
      const task = makePublishedTask({ id: 1, cartClicks: 0, orderConv: 0 });
      mockPublishRepo.findOne.mockResolvedValueOnce(task);
      const result = await TenantContext.run({ traceId: 't10a', tenantId: TENANT }, () =>
        svc.getFunnel(1),
      );
      expect(result).toEqual({ cartClicks: 0, orderConv: 0, conversionRate: 0 });
    });

    it('cartClicks=10,orderConv=4 → conversionRate=0.4', async () => {
      const task = makePublishedTask({ id: 2, cartClicks: 10, orderConv: 4 });
      mockPublishRepo.findOne.mockResolvedValueOnce(task);
      const result = await TenantContext.run({ traceId: 't10b', tenantId: TENANT }, () =>
        svc.getFunnel(2),
      );
      expect(result).toEqual({ cartClicks: 10, orderConv: 4, conversionRate: 0.4 });
    });
  });

  // —— 验收点 11：跨租户隔离 ——
  describe('验收点11 跨租户隔离', () => {
    it('不同 tenantId 下，repo 收到的 tenantId 参数正确', async () => {
      const T2 = 'tn-other';
      const script = makePublishableScript({ id: 1, tenantId: T2, attributionId: 'attr_t2_x' });
      const acc = makeAccount({ id: 1, tenantId: T2, platform: 'douyin' });

      // publish（T2）：幂等 → script → account
      mockPublishRepo.findOne.mockResolvedValueOnce(null);
      mockScriptRepo.findOne.mockResolvedValueOnce(script);
      mockAccountRepo.findOne.mockResolvedValueOnce(acc);
      mockPublishRepo.save.mockResolvedValueOnce({ id: 30 } as PublishTaskEntity);

      await TenantContext.run({ traceId: 't11a', tenantId: T2 }, () =>
        svc.publish({ scriptId: 1, accountIds: [1] }),
      );

      // 校验 scriptRepo.findOne 的 where.tenantId
      const scriptCall = mockScriptRepo.findOne.mock.calls.find((c) => {
        const w = (c[0] as FindOneCall | undefined)?.where;
        return w?.id === 1;
      });
      expect((scriptCall?.[0] as FindOneCall | undefined)?.where?.tenantId).toBe(T2);

      // 校验 accountRepo.findOne 的 where.tenantId
      const accCall = mockAccountRepo.findOne.mock.calls.find((c) => {
        const w = (c[0] as FindOneCall | undefined)?.where;
        return w?.id === 1;
      });
      expect((accCall?.[0] as FindOneCall | undefined)?.where?.tenantId).toBe(T2);

      // 校验幂等查询的 where.tenantId
      const idemCall = mockPublishRepo.findOne.mock.calls.find((c) => {
        const w = (c[0] as FindOneCall | undefined)?.where;
        return w?.status === PublishStatus.Published;
      });
      expect((idemCall?.[0] as FindOneCall | undefined)?.where?.tenantId).toBe(T2);

      // getPublish（T2）：where.tenantId 正确
      const task = makePublishedTask({ id: 30, tenantId: T2 });
      mockPublishRepo.findOne.mockResolvedValueOnce(task);
      await TenantContext.run({ traceId: 't11b', tenantId: T2 }, () => svc.getPublish(30));
      const getCall = mockPublishRepo.findOne.mock.calls.find((c) => {
        const w = (c[0] as FindOneCall | undefined)?.where;
        return w?.id === 30;
      });
      expect((getCall?.[0] as FindOneCall | undefined)?.where?.tenantId).toBe(T2);
    });
  });

  // —— 附加：无 TenantContext 防护 ——
  describe('租户上下文缺失防护', () => {
    it('未包裹 TenantContext.run 调用 publish → 抛 TENANT_REQUIRED', async () => {
      const dto: CreatePublishDto = { scriptId: 1, accountIds: [1] };
      await expect(svc.publish(dto)).rejects.toMatchObject({ code: 'TENANT_REQUIRED' });
    });
  });
});
