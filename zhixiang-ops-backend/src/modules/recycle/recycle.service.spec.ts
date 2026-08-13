import { Repository } from 'typeorm';
import { RecycleService } from './recycle.service';
import { TenantContext } from '../../tenant/tenant-context';
import { FeedbackEntity, RecycleTaskEntity, DriverEfficiencyEntity } from './recycle.entity';
import { RecycleScope, RecycleStatus } from './recycle.types';
import { CreateRecycleDto } from './dto/create-recycle.dto';
import { PublishTaskEntity } from '../publish/publish.entity';
import { PublishStatus } from '../publish/publish.types';
import { ScriptEntity } from '../script/script.entity';
import { ScriptStatus } from '../script/script.types';
import { TopicEntity } from '../topic/topic.entity';
import { TopicStatus } from '../topic/topic.types';
import { AnalyzeService } from '../analyze/analyze.service';
import { TopicService } from '../topic/topic.service';

/**
 * RecycleService（J 数据监控与回收）单元测试（规划 §4-J / R8 任务卡）。
 * 直接实例化 `new RecycleService(feedbackRepo, recycleTaskRepo, driverEfficiencyRepo,
 *   publishRepo, scriptRepo, topicRepo, analyzeService, topicService)`（不走 Nest DI）。
 *
 * 构造依赖顺序严格按 recycle.service.ts：
 *   feedbackRepo, recycleTaskRepo, driverEfficiencyRepo, publishRepo, scriptRepo, topicRepo, analyzeService, topicService
 *
 * 所有业务调用用 `TenantContext.run({ traceId, tenantId }, () => svc.xxx())` 包裹，
 * 否则 service 内的 requireTenantId 会抛 TENANT_REQUIRED。
 *
 * 合规边界②：仅存聚合表现与已脱敏评论，无单条个人信息落库（authorId/手机号等不得出现）。
 */

// —— 测试辅助：构造链式 QueryBuilder mock（返回类型指向自身 Qb，避免 any）——
type Qb = {
  where: jest.Mock<Qb, [string, Record<string, unknown>]>;
  andWhere: jest.Mock<Qb, [string, Record<string, unknown>]>;
  orderBy: jest.Mock<Qb, [string]>;
  addOrderBy: jest.Mock<Qb, [string]>;
  skip: jest.Mock<Qb, [number]>;
  take: jest.Mock<Qb, [number]>;
  getManyAndCount: jest.Mock<Promise<[unknown[], number]>, []>;
  getMany: jest.Mock<Promise<unknown[]>, []>;
};

function buildQueryBuilder(): Qb {
  const qb = {} as Qb;
  qb.where = jest.fn<Qb, [string, Record<string, unknown>]>().mockReturnThis();
  qb.andWhere = jest.fn<Qb, [string, Record<string, unknown>]>().mockReturnThis();
  qb.orderBy = jest.fn<Qb, [string]>().mockReturnThis();
  qb.addOrderBy = jest.fn<Qb, [string]>().mockReturnThis();
  qb.skip = jest.fn<Qb, [number]>().mockReturnThis();
  qb.take = jest.fn<Qb, [number]>().mockReturnThis();
  qb.getManyAndCount = jest.fn<Promise<[unknown[], number]>, []>().mockResolvedValue([[], 0]);
  qb.getMany = jest.fn<Promise<unknown[]>, []>().mockResolvedValue([]);
  return qb;
}

// —— 测试辅助：findOne/find 的调用参数形状（强类型，避免 any）——
type FindOpts = { where: Record<string, unknown> };

// —— 测试辅助：Repository 的最小强类型 mock（属性为 jest.Mock 实例，避免 any 与 unbound-method）——
type Repo<T> = {
  create: jest.Mock<T, [Partial<T>]>;
  save: jest.Mock<Promise<T>, [Partial<T>]>;
  findOne: jest.Mock<Promise<T | null>, [FindOpts]>;
  find: jest.Mock<Promise<T[]>, [FindOpts]>;
  update: jest.Mock<Promise<{ affected?: number }>, [FindOpts, Partial<T>]>;
  delete: jest.Mock<Promise<{ affected?: number }>, [FindOpts]>;
  createQueryBuilder: jest.Mock<unknown, []>;
};

// —— 测试辅助：服务 mock 的最小强类型 ——
type MockAnalyzeService = {
  reanalyzeFromRecycle: jest.Mock<Promise<{ taskId: number; traceId: string }>, [unknown?]>;
  getAnalysisTask: jest.Mock<Promise<{ status: string }>, [unknown?]>;
};
type MockTopicService = {
  reweightByEfficiency: jest.Mock<Promise<number>, [unknown?]>;
};

// —— mock 工厂：给 save 的实体补自增 id（模拟 TypeORM 主键回填）——
function autoIdSave<T extends { id?: number }>(
  entities: Map<string, number>,
): jest.Mock<Promise<T>, [Partial<T>]> {
  return jest.fn((e: Partial<T>) => {
    // 以实体构造名作为 key，逐次自增
    const key = (e as { constructor?: { name?: string } }).constructor?.name ?? 'anon';
    const next = (entities.get(key) ?? 0) + 1;
    entities.set(key, next);
    return Promise.resolve({ ...e, id: e.id ?? next } as T);
  });
}

function makePublish(partial: Partial<PublishTaskEntity> = {}): PublishTaskEntity {
  return {
    id: partial.id ?? 1,
    tenantId: partial.tenantId ?? 'tn-1',
    scriptId: partial.scriptId ?? 1,
    accountId: partial.accountId ?? 10,
    platform: partial.platform ?? 'douyin',
    attributionId: partial.attributionId ?? 'attr_tn-1_content_' + 'a'.repeat(32),
    extPostId: partial.extPostId ?? 'pub_tn-1_1_10',
    status: partial.status ?? ('published' as PublishStatus),
  } as PublishTaskEntity;
}

function makeScript(partial: Partial<ScriptEntity> = {}): ScriptEntity {
  return {
    id: partial.id ?? 1,
    tenantId: partial.tenantId ?? 'tn-1',
    topicId: partial.topicId ?? 1,
    attributionId: partial.attributionId ?? 'attr_tn-1_content_' + 'a'.repeat(32),
    title: partial.title ?? '脚本标题',
    content: partial.content ?? '脚本正文',
    hook: partial.hook ?? '钩子',
    hookEmotion: partial.hookEmotion ?? '好奇',
    version: partial.version ?? 1,
    status: partial.status ?? ('draft' as ScriptStatus),
    promptVersion: partial.promptVersion ?? 'v1',
    modelUsed: partial.modelUsed ?? '',
  } as ScriptEntity;
}

function makeTopic(partial: Partial<TopicEntity> = {}): TopicEntity {
  return {
    id: partial.id ?? 1,
    tenantId: partial.tenantId ?? 'tn-1',
    attributionId: partial.attributionId ?? 'attr_tn-1_content_' + 'a'.repeat(32),
    title: partial.title ?? '选题标题',
    humanDriver: partial.humanDriver ?? '贪',
    emotion: partial.emotion ?? '好奇',
    status: partial.status ?? ('idea' as TopicStatus),
    score: partial.score ?? 0,
    promptVersion: partial.promptVersion ?? 'v1',
    modelUsed: partial.modelUsed ?? '',
  } as TopicEntity;
}

function makeFeedback(partial: Partial<FeedbackEntity> = {}): FeedbackEntity {
  return {
    id: partial.id ?? 1,
    tenantId: partial.tenantId ?? 'tn-1',
    topicId: partial.topicId ?? 1,
    videoId: partial.videoId ?? 1,
    platform: partial.platform ?? 'douyin',
    attributionId: partial.attributionId ?? 'attr_tn-1_content_' + 'a'.repeat(32),
    metrics: partial.metrics ?? {
      play: 10000,
      completeRate: 0.5,
      interact: 200,
      fanInc: 100,
      commission: 5,
    },
    comments: partial.comments ?? [
      '这条讲贪的内容太戳我了，好奇到不行',
      '看完直接下单了，求贪更多选题',
    ],
    reAnalysisId: partial.reAnalysisId ?? null,
    collectedAt: partial.collectedAt ?? new Date(),
  } as FeedbackEntity;
}

describe('RecycleService', () => {
  let svc: RecycleService;
  let mockFeedbackRepo: Repo<FeedbackEntity>;
  let mockRecycleTaskRepo: Repo<RecycleTaskEntity>;
  let mockDriverEfficiencyRepo: Repo<DriverEfficiencyEntity>;
  let mockPublishRepo: Repo<PublishTaskEntity>;
  let mockScriptRepo: Repo<ScriptEntity>;
  let mockTopicRepo: Repo<TopicEntity>;
  let mockAnalyzeService: MockAnalyzeService;
  let mockTopicService: MockTopicService;

  let publishQb: ReturnType<typeof buildQueryBuilder>;
  let feedbackQb: ReturnType<typeof buildQueryBuilder>;
  let driverEffQb: ReturnType<typeof buildQueryBuilder>;
  let topicQb: ReturnType<typeof buildQueryBuilder>;

  let idMap: Map<string, number>;

  beforeEach(() => {
    idMap = new Map<string, number>();
    publishQb = buildQueryBuilder();
    feedbackQb = buildQueryBuilder();
    driverEffQb = buildQueryBuilder();
    topicQb = buildQueryBuilder();

    mockFeedbackRepo = {
      create: jest.fn<FeedbackEntity, [Partial<FeedbackEntity>]>((e) => e as FeedbackEntity),
      save: autoIdSave(idMap),
      findOne: jest.fn<Promise<FeedbackEntity | null>, [FindOpts]>(),
      find: jest.fn<Promise<FeedbackEntity[]>, [FindOpts]>().mockResolvedValue([]),
      update: jest
        .fn<Promise<{ affected?: number }>, [FindOpts, Partial<FeedbackEntity>]>()
        .mockResolvedValue({ affected: 1 }),
      delete: jest
        .fn<Promise<{ affected?: number }>, [FindOpts]>()
        .mockResolvedValue({ affected: 0 }),
      createQueryBuilder: jest.fn<unknown, []>().mockReturnValue(feedbackQb),
    };
    mockRecycleTaskRepo = {
      create: jest.fn<RecycleTaskEntity, [Partial<RecycleTaskEntity>]>(
        (e) => e as RecycleTaskEntity,
      ),
      save: autoIdSave(idMap),
      findOne: jest.fn<Promise<RecycleTaskEntity | null>, [FindOpts]>(),
      find: jest.fn<Promise<RecycleTaskEntity[]>, [FindOpts]>().mockResolvedValue([]),
      update: jest
        .fn<Promise<{ affected?: number }>, [FindOpts, Partial<RecycleTaskEntity>]>()
        .mockResolvedValue({ affected: 0 }),
      delete: jest
        .fn<Promise<{ affected?: number }>, [FindOpts]>()
        .mockResolvedValue({ affected: 0 }),
      createQueryBuilder: jest.fn<unknown, []>().mockReturnValue(undefined),
    };
    mockDriverEfficiencyRepo = {
      create: jest.fn<DriverEfficiencyEntity, [Partial<DriverEfficiencyEntity>]>(
        (e) => e as DriverEfficiencyEntity,
      ),
      save: autoIdSave(idMap),
      find: jest.fn<Promise<DriverEfficiencyEntity[]>, [FindOpts]>().mockResolvedValue([]),
      findOne: jest.fn<Promise<DriverEfficiencyEntity | null>, [FindOpts]>(),
      update: jest
        .fn<Promise<{ affected?: number }>, [FindOpts, Partial<DriverEfficiencyEntity>]>()
        .mockResolvedValue({ affected: 0 }),
      delete: jest
        .fn<Promise<{ affected?: number }>, [FindOpts]>()
        .mockResolvedValue({ affected: 0 }),
      createQueryBuilder: jest.fn<unknown, []>().mockReturnValue(driverEffQb),
    };
    mockPublishRepo = {
      create: jest.fn<PublishTaskEntity, [Partial<PublishTaskEntity>]>(
        (e) => e as PublishTaskEntity,
      ),
      save: autoIdSave(idMap),
      findOne: jest.fn<Promise<PublishTaskEntity | null>, [FindOpts]>(),
      find: jest.fn<Promise<PublishTaskEntity[]>, [FindOpts]>().mockResolvedValue([]),
      update: jest
        .fn<Promise<{ affected?: number }>, [FindOpts, Partial<PublishTaskEntity>]>()
        .mockResolvedValue({ affected: 0 }),
      delete: jest
        .fn<Promise<{ affected?: number }>, [FindOpts]>()
        .mockResolvedValue({ affected: 0 }),
      createQueryBuilder: jest.fn<unknown, []>().mockReturnValue(publishQb),
    };
    mockScriptRepo = {
      create: jest.fn<ScriptEntity, [Partial<ScriptEntity>]>((e) => e as ScriptEntity),
      save: autoIdSave(idMap),
      findOne: jest.fn<Promise<ScriptEntity | null>, [FindOpts]>(),
      find: jest.fn<Promise<ScriptEntity[]>, [FindOpts]>().mockResolvedValue([]),
      update: jest
        .fn<Promise<{ affected?: number }>, [FindOpts, Partial<ScriptEntity>]>()
        .mockResolvedValue({ affected: 0 }),
      delete: jest
        .fn<Promise<{ affected?: number }>, [FindOpts]>()
        .mockResolvedValue({ affected: 0 }),
      createQueryBuilder: jest.fn<unknown, []>().mockReturnValue(undefined),
    };
    mockTopicRepo = {
      create: jest.fn<TopicEntity, [Partial<TopicEntity>]>((e) => e as TopicEntity),
      save: autoIdSave(idMap),
      findOne: jest.fn<Promise<TopicEntity | null>, [FindOpts]>(),
      find: jest.fn<Promise<TopicEntity[]>, [FindOpts]>().mockResolvedValue([]),
      update: jest
        .fn<Promise<{ affected?: number }>, [FindOpts, Partial<TopicEntity>]>()
        .mockResolvedValue({ affected: 0 }),
      delete: jest
        .fn<Promise<{ affected?: number }>, [FindOpts]>()
        .mockResolvedValue({ affected: 0 }),
      createQueryBuilder: jest.fn<unknown, []>().mockReturnValue(topicQb),
    };
    mockAnalyzeService = {
      reanalyzeFromRecycle: jest
        .fn<Promise<{ taskId: number; traceId: string }>, [unknown?]>()
        .mockResolvedValue({ taskId: 99, traceId: 't' }),
      getAnalysisTask: jest
        .fn<Promise<{ status: string }>, [unknown?]>()
        .mockResolvedValue({ status: 'done' }),
    };
    mockTopicService = {
      reweightByEfficiency: jest.fn<Promise<number>, [unknown?]>().mockResolvedValue(2),
    };

    svc = new RecycleService(
      mockFeedbackRepo as unknown as Repository<FeedbackEntity>,
      mockRecycleTaskRepo as unknown as Repository<RecycleTaskEntity>,
      mockDriverEfficiencyRepo as unknown as Repository<DriverEfficiencyEntity>,
      mockPublishRepo as unknown as Repository<PublishTaskEntity>,
      mockScriptRepo as unknown as Repository<ScriptEntity>,
      mockTopicRepo as unknown as Repository<TopicEntity>,
      mockAnalyzeService as unknown as AnalyzeService,
      mockTopicService as unknown as TopicService,
    );
  });

  // ========== 验收点 1：createRecycle(scope=all) 正常 ==========
  describe('验收点1 createRecycle(scope=all) 正常', () => {
    it('消费 I 已发布任务 → feedbackRepo.save 被调用、返回 {taskId,traceId}、最终 task.status=done/progress=100、attributionId 透传 I 只读', async () => {
      const pub = makePublish();
      publishQb.getMany.mockResolvedValueOnce([pub]);
      mockScriptRepo.findOne.mockResolvedValueOnce(makeScript({ topicId: 1 }));
      mockTopicRepo.findOne.mockResolvedValueOnce(
        makeTopic({ id: 1, humanDriver: '贪', emotion: '好奇' }),
      );

      const dto: CreateRecycleDto = { scope: RecycleScope.All, targetRef: 'all' };
      const result = await TenantContext.run({ traceId: 't-rx-1', tenantId: 'tn-1' }, () =>
        svc.createRecycle(dto),
      );

      // 返回结构
      expect(result).toHaveProperty('taskId');
      expect(result).toHaveProperty('traceId');
      expect(result.traceId).toBe('t-rx-1');

      // feedback 落库
      expect(mockFeedbackRepo.save).toHaveBeenCalled();
      const savedFb = mockFeedbackRepo.save.mock.calls[0][0] as FeedbackEntity;
      expect(savedFb.attributionId).toBe(pub.attributionId); // 透传 I（只读，不得重生成）
      expect(savedFb.videoId).toBe(pub.id);
      expect(savedFb.platform).toBe(pub.platform);

      // task 最终 status/progress
      const taskSaves = mockRecycleTaskRepo.save.mock.calls.map((c) => c[0]) as RecycleTaskEntity[];
      const finalTask = taskSaves[taskSaves.length - 1];
      expect(finalTask.status).toBe(RecycleStatus.Done);
      expect(finalTask.progress).toBe(100);
      expect(finalTask.lastCollectedAt).toBeInstanceOf(Date);

      // reweightByEfficiency 被调用（反哺 E）
      expect(mockTopicService.reweightByEfficiency).toHaveBeenCalled();
    });

    it('【合规断言】落库 feedback.comments 仅为合成文本数组、metrics 仅含五维字段（合规边界②，无单条个人信息）', async () => {
      const pub = makePublish();
      publishQb.getMany.mockResolvedValueOnce([pub]);
      mockScriptRepo.findOne.mockResolvedValueOnce(makeScript({ topicId: 1 }));
      mockTopicRepo.findOne.mockResolvedValueOnce(
        makeTopic({ id: 1, humanDriver: '贪', emotion: '好奇' }),
      );

      const dto: CreateRecycleDto = { scope: RecycleScope.All, targetRef: 'all' };
      await TenantContext.run({ traceId: 't-rx-1c', tenantId: 'tn-1' }, () =>
        svc.createRecycle(dto),
      );

      const savedFb = mockFeedbackRepo.save.mock.calls[0][0] as FeedbackEntity;
      // comments 是字符串数组，且每个都是合成文本
      expect(Array.isArray(savedFb.comments)).toBe(true);
      for (const c of savedFb.comments as string[]) {
        expect(typeof c).toBe('string');
        // 不得含任何个人信息字段（authorId/手机号等）
        expect(c).not.toMatch(/1[3-9]\d{9}/); // 手机号
      }
      // metrics 仅含五维字段
      const allowed = ['play', 'completeRate', 'interact', 'fanInc', 'commission'];
      const keys = Object.keys(savedFb.metrics ?? {});
      for (const k of keys) {
        expect(allowed).toContain(k);
      }
      expect(keys.sort()).toEqual(allowed.slice().sort());
    });
  });

  // ========== 验收点 2：createRecycle(scope=video) ==========
  describe('验收点2 createRecycle(scope=video, targetRef=发布任务id)', () => {
    it('QueryBuilder 用 andWhere(p.id = :id) 过滤，getMany 返回对应任务', async () => {
      const pub = makePublish({ id: 7 });
      publishQb.getMany.mockResolvedValueOnce([pub]);
      mockScriptRepo.findOne.mockResolvedValueOnce(makeScript({ topicId: 1 }));
      mockTopicRepo.findOne.mockResolvedValueOnce(makeTopic({ id: 1 }));

      const dto: CreateRecycleDto = { scope: RecycleScope.Video, targetRef: '7' };
      const result = await TenantContext.run({ traceId: 't-rx-2', tenantId: 'tn-1' }, () =>
        svc.createRecycle(dto),
      );

      expect(result).toHaveProperty('taskId');
      expect(publishQb.where).toHaveBeenCalledWith('p.tenant_id = :tenantId', { tenantId: 'tn-1' });
      expect(publishQb.andWhere).toHaveBeenCalledWith('p.id = :id', { id: 7 });
      expect(mockFeedbackRepo.save).toHaveBeenCalled();
    });
  });

  // ========== 验收点 3：createRecycle(scope=account) ==========
  describe('验收点3 createRecycle(scope=account, targetRef=账号id)', () => {
    it('QueryBuilder 用 andWhere(p.account_id = :acc) 过滤', async () => {
      const pub = makePublish({ accountId: 42 });
      publishQb.getMany.mockResolvedValueOnce([pub]);
      mockScriptRepo.findOne.mockResolvedValueOnce(makeScript({ topicId: 1 }));
      mockTopicRepo.findOne.mockResolvedValueOnce(makeTopic({ id: 1 }));

      const dto: CreateRecycleDto = { scope: RecycleScope.Account, targetRef: '42' };
      const result = await TenantContext.run({ traceId: 't-rx-3', tenantId: 'tn-1' }, () =>
        svc.createRecycle(dto),
      );

      expect(result).toHaveProperty('taskId');
      expect(publishQb.andWhere).toHaveBeenCalledWith('p.account_id = :acc', { acc: 42 });
      expect(mockFeedbackRepo.save).toHaveBeenCalled();
    });
  });

  // ========== 验收点 4：createRecycle 无发布数据 ==========
  describe('验收点4 createRecycle 无发布数据', () => {
    it('getMany 返回 [] → 抛 RECYCLE_NO_DATA', async () => {
      publishQb.getMany.mockResolvedValueOnce([]);
      const dto: CreateRecycleDto = { scope: RecycleScope.All, targetRef: 'all' };
      await expect(
        TenantContext.run({ traceId: 't-rx-4', tenantId: 'tn-1' }, () => svc.createRecycle(dto)),
      ).rejects.toMatchObject({ code: 'RECYCLE_NO_DATA' });
    });
  });

  // ========== 验收点 5：createRecycle(scope=video, targetRef=非法字符串) ==========
  describe('验收点5 createRecycle 非法 targetRef', () => {
    it("scope=video 且 targetRef='非法字符串' → 抛 RECYCLE_TARGET_INVALID", async () => {
      const dto: CreateRecycleDto = { scope: RecycleScope.Video, targetRef: '非法字符串' };
      await expect(
        TenantContext.run({ traceId: 't-rx-5', tenantId: 'tn-1' }, () => svc.createRecycle(dto)),
      ).rejects.toMatchObject({ code: 'RECYCLE_TARGET_INVALID' });
    });

    it("scope=account 且 targetRef='非法字符串' → 抛 RECYCLE_TARGET_INVALID", async () => {
      const dto: CreateRecycleDto = { scope: RecycleScope.Account, targetRef: '非法字符串' };
      await expect(
        TenantContext.run({ traceId: 't-rx-5b', tenantId: 'tn-1' }, () => svc.createRecycle(dto)),
      ).rejects.toMatchObject({ code: 'RECYCLE_TARGET_INVALID' });
    });
  });

  // ========== 验收点 6：getRecycle ==========
  describe('验收点6 getRecycle', () => {
    it('recycleTaskRepo.findOne 返回任务 → 返回实体（where 带 tenantId）', async () => {
      const task = {
        id: 5,
        tenantId: 'tn-1',
        scope: 'all',
        status: 'done',
        progress: 100,
      } as RecycleTaskEntity;
      mockRecycleTaskRepo.findOne.mockResolvedValueOnce(task);

      const result = await TenantContext.run({ traceId: 't-rx-6', tenantId: 'tn-1' }, () =>
        svc.getRecycle(5),
      );
      expect(result.id).toBe(5);
      expect(mockRecycleTaskRepo.findOne.mock.calls[0][0]).toEqual({
        where: { id: 5, tenantId: 'tn-1' },
      });
    });

    it('不存在 → 抛 RECYCLE_TASK_NOT_FOUND', async () => {
      mockRecycleTaskRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        TenantContext.run({ traceId: 't-rx-6b', tenantId: 'tn-1' }, () => svc.getRecycle(999)),
      ).rejects.toMatchObject({ code: 'RECYCLE_TASK_NOT_FOUND' });
    });
  });

  // ========== 验收点 7：getDashboardOverview ==========
  describe('验收点7 getDashboardOverview', () => {
    it('带 metrics 的 feedback → 五维求和正确、四率计算正确、videoCount 正确', async () => {
      const fbs = [
        makeFeedback({
          id: 1,
          videoId: 1,
          metrics: { play: 10000, completeRate: 0.5, interact: 200, fanInc: 100, commission: 5 },
        }),
        makeFeedback({
          id: 2,
          videoId: 2,
          metrics: { play: 20000, completeRate: 0.8, interact: 600, fanInc: 300, commission: 20 },
        }),
      ];
      mockFeedbackRepo.find.mockResolvedValueOnce(fbs);

      const result = await TenantContext.run({ traceId: 't-rx-7', tenantId: 'tn-1' }, () =>
        svc.getDashboardOverview(),
      );

      expect(result.totalPlay).toBe(30000);
      expect(result.totalInteract).toBe(800);
      expect(result.totalFanInc).toBe(400);
      expect(result.totalCommission).toBe(25);
      // avgCompleteRate = (0.5+0.8)/2 = 0.65
      expect(result.avgCompleteRate).toBe(0.65);
      // interactRate = 800/30000
      expect(result.interactRate).toBe(Number((800 / 30000).toFixed(4)));
      expect(result.fanRate).toBe(Number((400 / 30000).toFixed(4)));
      expect(result.conversionRate).toBe(Number((25 / 30000).toFixed(4)));
      expect(result.videoCount).toBe(2);
      // where 带 tenantId
      expect(mockFeedbackRepo.find.mock.calls[0][0]).toEqual({ where: { tenantId: 'tn-1' } });
    });

    it('空 find 结果 → 抛 RECYCLE_NO_DATA', async () => {
      mockFeedbackRepo.find.mockResolvedValueOnce([]);
      await expect(
        TenantContext.run({ traceId: 't-rx-7b', tenantId: 'tn-1' }, () =>
          svc.getDashboardOverview(),
        ),
      ).rejects.toMatchObject({ code: 'RECYCLE_NO_DATA' });
    });
  });

  // ========== 验收点 8：getDriverEfficiency ==========
  describe('验收点8 getDriverEfficiency', () => {
    it('driverEfficiencyRepo.find 返回已存行 → 按 avgPlay 降序返回', async () => {
      const rows = [
        {
          id: 1,
          tenantId: 'tn-1',
          driver: '贪',
          emotion: '好奇',
          avgPlay: 5000,
        } as DriverEfficiencyEntity,
        {
          id: 2,
          tenantId: 'tn-1',
          driver: '懒',
          emotion: '共鸣',
          avgPlay: 9000,
        } as DriverEfficiencyEntity,
      ];
      mockDriverEfficiencyRepo.find.mockResolvedValueOnce(rows);

      const result = await TenantContext.run({ traceId: 't-rx-8', tenantId: 'tn-1' }, () =>
        svc.getDriverEfficiency(),
      );
      // 排序交由数据库 order: { avgPlay: 'DESC' } 完成；mock 原样返回，断言传入的 order 选项正确
      expect(mockDriverEfficiencyRepo.find.mock.calls[0][0]).toEqual({
        where: { tenantId: 'tn-1' },
        order: { avgPlay: 'DESC' },
      });
      expect(result.length).toBe(2);
    });

    it('find 返回空 → computeDriverEfficiency 兜底（delete + save 被调用且返回计算行）', async () => {
      mockDriverEfficiencyRepo.find.mockResolvedValueOnce([]);
      // 兜底需 feedback 与 topic 数据计算
      mockFeedbackRepo.find.mockResolvedValueOnce([
        makeFeedback({
          id: 1,
          topicId: 1,
          metrics: { play: 12000, completeRate: 0.6, interact: 300, fanInc: 120, commission: 6 },
        }),
      ]);
      mockTopicRepo.find.mockResolvedValueOnce([
        makeTopic({ id: 1, humanDriver: '贪', emotion: '好奇' }),
      ]);

      const result = await TenantContext.run({ traceId: 't-rx-8b', tenantId: 'tn-1' }, () =>
        svc.getDriverEfficiency(),
      );
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0].driver).toBe('贪');
      expect(result[0].emotion).toBe('好奇');
      // 兜底计算会 delete 旧行 + save 新行
      expect(mockDriverEfficiencyRepo.delete).toHaveBeenCalled();
      expect(mockDriverEfficiencyRepo.save).toHaveBeenCalled();
    });
  });

  // ========== 验收点 9：getFeedback ==========
  describe('验收点9 getFeedback', () => {
    it('feedbackRepo.findOne 返回 feedback（含 reAnalysisId=99）→ 返回含 feedback 且 reanalysisStatus=done', async () => {
      const fb = makeFeedback({ id: 1, reAnalysisId: 99 });
      mockFeedbackRepo.findOne.mockResolvedValueOnce(fb);
      mockAnalyzeService.getAnalysisTask.mockResolvedValueOnce({ status: 'done' });

      const result = await TenantContext.run({ traceId: 't-rx-9', tenantId: 'tn-1' }, () =>
        svc.getFeedback(1),
      );
      expect(result.feedback.id).toBe(1);
      expect(result.reanalysisStatus).toBe('done');
      expect(mockFeedbackRepo.findOne.mock.calls[0][0]).toEqual({
        where: { tenantId: 'tn-1', videoId: 1 },
      });
      expect(mockAnalyzeService.getAnalysisTask).toHaveBeenCalledWith(99);
    });

    it('不存在 → 抛 FEEDBACK_NOT_FOUND', async () => {
      mockFeedbackRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        TenantContext.run({ traceId: 't-rx-9b', tenantId: 'tn-1' }, () => svc.getFeedback(999)),
      ).rejects.toMatchObject({ code: 'FEEDBACK_NOT_FOUND' });
    });

    it('feedback 无 reAnalysisId → reanalysisStatus 为 undefined', async () => {
      const fb = makeFeedback({ id: 1, reAnalysisId: null });
      mockFeedbackRepo.findOne.mockResolvedValueOnce(fb);
      const result = await TenantContext.run({ traceId: 't-rx-9c', tenantId: 'tn-1' }, () =>
        svc.getFeedback(1),
      );
      expect(result.reanalysisStatus).toBeUndefined();
      expect(mockAnalyzeService.getAnalysisTask).not.toHaveBeenCalled();
    });
  });

  // ========== 验收点 10：rerunAnalysis ==========
  describe('验收点10 rerunAnalysis', () => {
    it('feedback 带 comments 与 attributionId → analyzeService.reanalyzeFromRecycle 被调用、feedbackRepo.update 回写、返回 {analysisId,traceId,feedbackCount}', async () => {
      const fb1 = makeFeedback({
        id: 1,
        attributionId: 'attr_tn-1_content_' + 'a'.repeat(32),
        comments: ['评论A', '评论B'],
      });
      mockFeedbackRepo.find.mockResolvedValueOnce([fb1]);

      const result = await TenantContext.run({ traceId: 't-rx-10', tenantId: 'tn-1' }, () =>
        svc.rerunAnalysis(),
      );

      expect(mockAnalyzeService.reanalyzeFromRecycle).toHaveBeenCalledWith(
        ['评论A', '评论B'],
        'attr_tn-1_content_' + 'a'.repeat(32),
      );
      expect(mockFeedbackRepo.update).toHaveBeenCalledWith(
        { tenantId: 'tn-1', attributionId: 'attr_tn-1_content_' + 'a'.repeat(32) },
        { reAnalysisId: 99 },
      );
      expect(result.analysisId).toBe(99);
      expect(result.feedbackCount).toBe(1);
      expect(result.traceId).toBe('t-rx-10');
    });

    it('空 find → 抛 RECYCLE_NO_DATA', async () => {
      mockFeedbackRepo.find.mockResolvedValueOnce([]);
      await expect(
        TenantContext.run({ traceId: 't-rx-10b', tenantId: 'tn-1' }, () => svc.rerunAnalysis()),
      ).rejects.toMatchObject({ code: 'RECYCLE_NO_DATA' });
    });

    it('feedback 无 comments → 抛 RECYCLE_NO_DATA', async () => {
      const fb = makeFeedback({ id: 1, comments: [] });
      mockFeedbackRepo.find.mockResolvedValueOnce([fb]);
      await expect(
        TenantContext.run({ traceId: 't-rx-10c', tenantId: 'tn-1' }, () => svc.rerunAnalysis()),
      ).rejects.toMatchObject({ code: 'RECYCLE_NO_DATA' });
    });
  });

  // ========== 验收点 11：跨租户隔离 ==========
  describe('验收点11 跨租户隔离', () => {
    it('所有返回/抛错路径的 repo 调用均传入 tenantId=tn-1', async () => {
      // (1) getDashboardOverview：feedbackRepo.find 的 where 含 tenantId='tn-1'
      mockFeedbackRepo.find.mockResolvedValueOnce([makeFeedback()]);
      await TenantContext.run({ traceId: 't-rx-11a', tenantId: 'tn-1' }, () =>
        svc.getDashboardOverview(),
      );
      expect(mockFeedbackRepo.find.mock.calls[0][0].where.tenantId).toBe('tn-1');

      // (2) getFeedback：findOne where 含 tenantId
      mockFeedbackRepo.findOne.mockResolvedValueOnce(makeFeedback({ reAnalysisId: null }));
      await TenantContext.run({ traceId: 't-rx-11b', tenantId: 'tn-1' }, () => svc.getFeedback(1));
      expect(mockFeedbackRepo.findOne.mock.calls[0][0].where.tenantId).toBe('tn-1');

      // (3) getRecycle：findOne where 含 tenantId
      mockRecycleTaskRepo.findOne.mockResolvedValueOnce({
        id: 1,
        tenantId: 'tn-1',
      } as RecycleTaskEntity);
      await TenantContext.run({ traceId: 't-rx-11c', tenantId: 'tn-1' }, () => svc.getRecycle(1));
      expect(mockRecycleTaskRepo.findOne.mock.calls[0][0].where.tenantId).toBe('tn-1');

      // (4) getDriverEfficiency：find where 含 tenantId
      mockDriverEfficiencyRepo.find.mockResolvedValueOnce([]);
      mockFeedbackRepo.find.mockResolvedValueOnce([]);
      await TenantContext.run({ traceId: 't-rx-11d', tenantId: 'tn-1' }, () =>
        svc.getDriverEfficiency(),
      );
      expect(mockDriverEfficiencyRepo.find.mock.calls[0][0].where.tenantId).toBe('tn-1');

      // (5) rerunAnalysis：find where 含 tenantId
      mockFeedbackRepo.find.mockResolvedValueOnce([]);
      await expect(
        TenantContext.run({ traceId: 't-rx-11e', tenantId: 'tn-1' }, () => svc.rerunAnalysis()),
      ).rejects.toMatchObject({ code: 'RECYCLE_NO_DATA' });
      expect(mockFeedbackRepo.find.mock.calls.slice(-1)[0][0].where.tenantId).toBe('tn-1');

      // (6) createRecycle：publishRepo.createQueryBuilder.where 含 tenant_id
      publishQb.getMany.mockResolvedValueOnce([]);
      await expect(
        TenantContext.run({ traceId: 't-rx-11f', tenantId: 'tn-1' }, () =>
          svc.createRecycle({ scope: RecycleScope.All, targetRef: 'all' }),
        ),
      ).rejects.toMatchObject({ code: 'RECYCLE_NO_DATA' });
      expect(publishQb.where).toHaveBeenCalledWith('p.tenant_id = :tenantId', { tenantId: 'tn-1' });
    });

    it('不同 tenantId 下 createRecycle 的 QueryBuilder where 参数正确', async () => {
      const whereCalls: Array<{ sql: string; param: unknown }> = [];
      publishQb.where.mockImplementation((sql: string, param: unknown) => {
        whereCalls.push({ sql, param });
        return publishQb;
      });
      publishQb.getMany.mockResolvedValueOnce([]);
      await expect(
        TenantContext.run({ traceId: 't-rx-11g', tenantId: 'tn-7' }, () =>
          svc.createRecycle({ scope: RecycleScope.All, targetRef: 'all' }),
        ),
      ).rejects.toMatchObject({ code: 'RECYCLE_NO_DATA' });
      const w = whereCalls.find((x) => x.sql.startsWith('p.tenant_id'));
      expect(w?.param).toEqual({ tenantId: 'tn-7' });
    });
  });

  // ========== 附加：无 TenantContext 防护 ==========
  describe('租户上下文缺失防护', () => {
    it('未包裹 TenantContext.run 调用 getRecycle → 抛 TENANT_REQUIRED', async () => {
      await expect(svc.getRecycle(1)).rejects.toMatchObject({ code: 'TENANT_REQUIRED' });
    });
  });
});
