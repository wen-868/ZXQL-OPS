import { Repository } from 'typeorm';
import { IntelService } from './intel.service';
import { RedisService } from '../../cache/redis.service';
import { TenantContext } from '../../tenant/tenant-context';
import { CompetitorEntity } from './competitor.entity';
import { CollectedCommentEntity } from './collected-comment.entity';
import { CollectTaskEntity } from './collect-task.entity';
import { CollectSourceEntity } from './collect-source.entity';
import { HotSnapshotEntity } from './hot-snapshot.entity';
import { CollectRateLimiter } from './rate-limiter';
import { CollectorGateway } from './collector/collector.gateway';
import { RawComment, RawHot } from './collector/collector.adapter';
import {
  CollectControlAction,
  CollectTaskStatus,
  CollectTaskType,
  CommentReviewStatus,
  HotType,
  SourceLevel,
} from './intel.types';
import { CreateCompetitorDto } from './dto/create-competitor.dto';
import { CreateCollectTaskDto } from './dto/create-collect-task.dto';
import { KeywordMineDto } from './dto/keyword-mine.dto';

/**
 * IntelService 单元测试（规划 §4-C）。
 * 直接实例化 `new IntelService(...)`（不走 Nest DI）。
 * 所有业务调用用 `TenantContext.run({ traceId, tenantId }, () => svc.xxx())` 包裹，
 * 否则 service 内的 requireTenantId 会抛 TENANT_REQUIRED。
 *
 * Mock 全部强类型化：Repository 用最小 Repo<T> 接口，QueryBuilder 用 Qb，
 * 适配器用 MockAdapter；不出现 any，桥接处用 as unknown as 转真实类型。
 */

type FindOpts = { where: Record<string, unknown> };

type Repo<T> = {
  create: jest.Mock<T, [Partial<T>]>;
  save: jest.Mock<Promise<T>, [Partial<T>]>;
  findOne: jest.Mock<Promise<T | null>, [FindOpts]>;
  find: jest.Mock<Promise<T[]>, [FindOpts]>;
  update: jest.Mock<
    Promise<{ affected?: number }>,
    [Record<string, unknown>, Record<string, unknown>]
  >;
  softDelete: jest.Mock<Promise<{ affected?: number }>, [Record<string, unknown>]>;
  createQueryBuilder: jest.Mock<unknown, [unknown?]>;
};

type MockAdapter = {
  fetchComments: jest.Mock<Promise<RawComment[]>, [CollectTaskEntity]>;
  fetchHot: jest.Mock<Promise<RawHot[]>, [string, HotType]>;
  mineKeywords: jest.Mock<Promise<string[]>, [string, string]>;
};

type Qb = {
  where: jest.Mock<Qb, [string, Record<string, unknown>]>;
  andWhere: jest.Mock<Qb, [string, Record<string, unknown>]>;
  orderBy: jest.Mock<Qb, [string]>;
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
  qb.skip = jest.fn<Qb, [number]>().mockReturnThis();
  qb.take = jest.fn<Qb, [number]>().mockReturnThis();
  qb.getManyAndCount = jest.fn<Promise<[unknown[], number]>, []>().mockResolvedValue([[], 0]);
  qb.getMany = jest.fn<Promise<unknown[]>, []>().mockResolvedValue([]);
  return qb;
}

describe('IntelService', () => {
  let svc: IntelService;
  let mockCompetitorRepo: Repo<CompetitorEntity>;
  let mockCommentRepo: Repo<CollectedCommentEntity>;
  let mockTaskRepo: Repo<CollectTaskEntity>;
  let mockSourceRepo: Repo<CollectSourceEntity>;
  let mockHotRepo: Repo<HotSnapshotEntity>;
  let mockRateLimiter: { allow: jest.Mock<Promise<boolean>, [string, string, number, number]> };
  let mockGateway: { resolve: jest.Mock<MockAdapter, [string]> };
  let mockRedis: {
    getJson: jest.Mock<Promise<unknown>, [string]>;
    setJson: jest.Mock<Promise<void>, [string, unknown, number?]>;
    del: jest.Mock<Promise<number>, [string]>;
  };
  let fakeAdapter: MockAdapter;
  let qb: Qb;

  beforeEach(() => {
    qb = buildQueryBuilder();
    fakeAdapter = {
      fetchComments: jest.fn<Promise<RawComment[]>, [CollectTaskEntity]>(),
      fetchHot: jest.fn<Promise<RawHot[]>, [string, HotType]>(),
      mineKeywords: jest.fn<Promise<string[]>, [string, string]>(),
    };
    mockCompetitorRepo = {
      create: jest.fn<CompetitorEntity, [Partial<CompetitorEntity>]>((e) => e as CompetitorEntity),
      save: jest
        .fn<Promise<CompetitorEntity>, [Partial<CompetitorEntity>]>()
        .mockImplementation((e) => Promise.resolve(e as CompetitorEntity)),
      findOne: jest.fn<Promise<CompetitorEntity | null>, [FindOpts]>(),
      find: jest.fn<Promise<CompetitorEntity[]>, [FindOpts]>().mockResolvedValue([]),
      update: jest
        .fn<Promise<{ affected?: number }>, [Record<string, unknown>, Record<string, unknown>]>()
        .mockResolvedValue({ affected: 1 }),
      softDelete: jest
        .fn<Promise<{ affected?: number }>, [Record<string, unknown>]>()
        .mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn<unknown, [unknown?]>().mockReturnValue(qb),
    };
    mockCommentRepo = {
      create: jest.fn<CollectedCommentEntity, [Partial<CollectedCommentEntity>]>(
        (e) => e as CollectedCommentEntity,
      ),
      save: jest
        .fn<Promise<CollectedCommentEntity>, [Partial<CollectedCommentEntity>]>()
        .mockImplementation((e) => Promise.resolve(e as CollectedCommentEntity)),
      findOne: jest.fn<Promise<CollectedCommentEntity | null>, [FindOpts]>(),
      find: jest.fn<Promise<CollectedCommentEntity[]>, [FindOpts]>().mockResolvedValue([]),
      update: jest
        .fn<Promise<{ affected?: number }>, [Record<string, unknown>, Record<string, unknown>]>()
        .mockResolvedValue({ affected: 1 }),
      softDelete: jest
        .fn<Promise<{ affected?: number }>, [Record<string, unknown>]>()
        .mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn<unknown, [unknown?]>().mockReturnValue(qb),
    };
    mockTaskRepo = {
      create: jest.fn<CollectTaskEntity, [Partial<CollectTaskEntity>]>(
        (e) => e as CollectTaskEntity,
      ),
      save: jest
        .fn<Promise<CollectTaskEntity>, [Partial<CollectTaskEntity>]>()
        .mockImplementation((e) => Promise.resolve(e as CollectTaskEntity)),
      findOne: jest.fn<Promise<CollectTaskEntity | null>, [FindOpts]>(),
      find: jest.fn<Promise<CollectTaskEntity[]>, [FindOpts]>().mockResolvedValue([]),
      update: jest
        .fn<Promise<{ affected?: number }>, [Record<string, unknown>, Record<string, unknown>]>()
        .mockResolvedValue({ affected: 1 }),
      softDelete: jest
        .fn<Promise<{ affected?: number }>, [Record<string, unknown>]>()
        .mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn<unknown, [unknown?]>().mockReturnValue(qb),
    };
    mockHotRepo = {
      create: jest.fn<HotSnapshotEntity, [Partial<HotSnapshotEntity>]>(
        (e) => e as HotSnapshotEntity,
      ),
      save: jest
        .fn<Promise<HotSnapshotEntity>, [Partial<HotSnapshotEntity>]>()
        .mockImplementation((e) => Promise.resolve(e as HotSnapshotEntity)),
      findOne: jest.fn<Promise<HotSnapshotEntity | null>, [FindOpts]>(),
      find: jest.fn<Promise<HotSnapshotEntity[]>, [FindOpts]>().mockResolvedValue([]),
      update: jest
        .fn<Promise<{ affected?: number }>, [Record<string, unknown>, Record<string, unknown>]>()
        .mockResolvedValue({ affected: 1 }),
      softDelete: jest
        .fn<Promise<{ affected?: number }>, [Record<string, unknown>]>()
        .mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn<unknown, [unknown?]>().mockReturnValue(qb),
    };
    mockRedis = {
      getJson: jest.fn<Promise<unknown>, [string]>().mockResolvedValue(null),
      setJson: jest.fn<Promise<void>, [string, unknown, number?]>().mockResolvedValue(undefined),
      del: jest.fn<Promise<number>, [string]>().mockResolvedValue(1),
    };
    mockRateLimiter = {
      allow: jest.fn<Promise<boolean>, [string, string, number, number]>().mockResolvedValue(true),
    };
    mockGateway = {
      resolve: jest.fn<MockAdapter, [string]>().mockReturnValue(fakeAdapter),
    };
    mockSourceRepo = {
      create: jest.fn<CollectSourceEntity, [Partial<CollectSourceEntity>]>(
        (e) => e as CollectSourceEntity,
      ),
      save: jest
        .fn<Promise<CollectSourceEntity>, [Partial<CollectSourceEntity>]>()
        .mockImplementation((e) => Promise.resolve(e as CollectSourceEntity)),
      findOne: jest.fn<Promise<CollectSourceEntity | null>, [FindOpts]>(),
      find: jest.fn<Promise<CollectSourceEntity[]>, [FindOpts]>().mockResolvedValue([]),
      update: jest
        .fn<Promise<{ affected?: number }>, [Record<string, unknown>, Record<string, unknown>]>()
        .mockResolvedValue({ affected: 1 }),
      softDelete: jest
        .fn<Promise<{ affected?: number }>, [Record<string, unknown>]>()
        .mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn<unknown, [unknown?]>().mockReturnValue(qb),
    };
    svc = new IntelService(
      mockCompetitorRepo as unknown as Repository<CompetitorEntity>,
      mockCommentRepo as unknown as Repository<CollectedCommentEntity>,
      mockTaskRepo as unknown as Repository<CollectTaskEntity>,
      mockSourceRepo as unknown as Repository<CollectSourceEntity>,
      mockHotRepo as unknown as Repository<HotSnapshotEntity>,
      mockRateLimiter as unknown as CollectRateLimiter,
      mockGateway as unknown as CollectorGateway,
      mockRedis as unknown as RedisService,
    );
  });

  // —— 验收点 1：竞品 create ——
  describe('createCompetitor', () => {
    it('返回对象含 tenantId/platform/name，monitorEnabled 默认 false，healthScore=0', async () => {
      const dto: CreateCompetitorDto = { platform: 'douyin', name: '竞品A' };
      const result = await TenantContext.run({ traceId: 't1', tenantId: 'tn-1' }, () =>
        svc.createCompetitor(dto),
      );

      expect(result.tenantId).toBe('tn-1');
      expect(result.platform).toBe('douyin');
      expect(result.name).toBe('竞品A');
      expect(result.monitorEnabled).toBe(false);
      expect(result.healthScore).toBe(0);
      // create 入参带了 tenantId
      expect(mockCompetitorRepo.create.mock.calls[0][0].tenantId).toBe('tn-1');
    });
  });

  // —— 验收点 2：竞品 findOne 不存在/存在 ——
  describe('findOneCompetitor', () => {
    it('不存在 → 抛 AppError 且 code===COMPETITOR_NOT_FOUND', async () => {
      mockCompetitorRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        TenantContext.run({ traceId: 't2', tenantId: 'tn-1' }, () => svc.findOneCompetitor(999)),
      ).rejects.toMatchObject({ code: 'COMPETITOR_NOT_FOUND' });
    });

    it('存在 → 返回实体，且 where 带 id+tenantId', async () => {
      mockCompetitorRepo.findOne.mockResolvedValueOnce({
        id: 1,
        tenantId: 'tn-1',
        platform: 'douyin',
        name: '竞品A',
      } as unknown as CompetitorEntity);

      const result = await TenantContext.run({ traceId: 't2b', tenantId: 'tn-1' }, () =>
        svc.findOneCompetitor(1),
      );

      expect(result.id).toBe(1);
      expect(mockCompetitorRepo.findOne.mock.calls[0][0]).toEqual({
        where: { id: 1, tenantId: 'tn-1' },
      });
    });
  });

  // —— 验收点 3：竞品 update / toggleMonitor ——
  describe('update / toggleMonitor', () => {
    it('局部更新后返回新值', async () => {
      mockCompetitorRepo.findOne.mockResolvedValueOnce({
        id: 1,
        tenantId: 'tn-1',
        platform: 'douyin',
        name: '旧名',
        monitorEnabled: false,
      } as unknown as CompetitorEntity);

      const result = await TenantContext.run({ traceId: 't3', tenantId: 'tn-1' }, () =>
        svc.updateCompetitor(1, { name: '新名' }),
      );

      expect(result.name).toBe('新名');
      const saved = mockCompetitorRepo.save.mock.calls[0][0] as unknown as CompetitorEntity;
      expect(saved.name).toBe('新名');
      expect(saved.monitorEnabled).toBe(false); // 未传则不翻转
    });

    it('toggleMonitor 翻转 monitorEnabled', async () => {
      mockCompetitorRepo.findOne.mockResolvedValueOnce({
        id: 1,
        tenantId: 'tn-1',
        platform: 'douyin',
        name: '竞品A',
        monitorEnabled: false,
      } as unknown as CompetitorEntity);

      const result = await TenantContext.run({ traceId: 't3b', tenantId: 'tn-1' }, () =>
        svc.toggleMonitor(1),
      );

      expect(result.monitorEnabled).toBe(true);
      const saved = mockCompetitorRepo.save.mock.calls[0][0] as unknown as CompetitorEntity;
      expect(saved.monitorEnabled).toBe(true);
    });
  });

  // —— 验收点 4：竞品 remove 调用 softDelete ——
  describe('removeCompetitor', () => {
    it('存在 → 调用 softDelete({id,tenantId})，返回 {id}', async () => {
      mockCompetitorRepo.findOne.mockResolvedValueOnce({
        id: 5,
        tenantId: 'tn-1',
        platform: 'douyin',
        name: '竞品A',
      } as unknown as CompetitorEntity);

      const result = await TenantContext.run({ traceId: 't4', tenantId: 'tn-1' }, () =>
        svc.removeCompetitor(5),
      );

      expect(mockCompetitorRepo.softDelete).toHaveBeenCalledWith({ id: 5, tenantId: 'tn-1' });
      expect(result).toEqual({ id: 5 });
    });
  });

  // —— 验收点 5：跨租户隔离 ——
  describe('跨租户隔离', () => {
    it('listCompetitors / findCleanComments / createCollectTask 的 where 携带正确 tenantId', async () => {
      mockCompetitorRepo.find.mockImplementation((opts: FindOpts) =>
        Promise.resolve(
          opts.where.tenantId === 'tn-1'
            ? ([{ id: 1, tenantId: 'tn-1' }] as unknown as CompetitorEntity[])
            : ([{ id: 2, tenantId: 'tn-2' }] as unknown as CompetitorEntity[]),
        ),
      );
      qb.getManyAndCount.mockResolvedValueOnce([[], 0]);

      await TenantContext.run({ traceId: 't5a', tenantId: 'tn-1' }, () => svc.listCompetitors());
      await TenantContext.run({ traceId: 't5b', tenantId: 'tn-1' }, () =>
        svc.findCleanComments({ page: 1, pageSize: 20 }),
      );
      const ctaskDto: CreateCollectTaskDto = {
        type: CollectTaskType.Comment,
        target: 'x',
        platform: 'douyin',
        sourceLevel: 'L1',
      };
      await TenantContext.run({ traceId: 't5c', tenantId: 'tn-1' }, () =>
        svc.createCollectTask(ctaskDto),
      );

      expect(
        mockCompetitorRepo.find.mock.calls.some((c: [FindOpts]) => c[0].where.tenantId === 'tn-1'),
      ).toBe(true);
      expect(qb.where).toHaveBeenCalledWith('c.tenant_id = :tenantId', { tenantId: 'tn-1' });
      const taskCreate = mockTaskRepo.create.mock.calls.find(
        (c: [Partial<CollectTaskEntity>]) => c[0].tenantId === 'tn-1',
      );
      expect(taskCreate).toBeDefined();
    });
  });

  // —— 验收点 6：createCollectTask 限频 ——
  describe('createCollectTask 限频', () => {
    it('rateLimiter.allow 返回 false → 抛 COLLECT_RATE_LIMITED', async () => {
      mockRateLimiter.allow.mockResolvedValueOnce(false);
      const ctaskDto: CreateCollectTaskDto = {
        type: CollectTaskType.Comment,
        target: 'x',
        platform: 'douyin',
        sourceLevel: 'L1',
      };
      await expect(
        TenantContext.run({ traceId: 't6a', tenantId: 'tn-1' }, () =>
          svc.createCollectTask(ctaskDto),
        ),
      ).rejects.toMatchObject({ code: 'COLLECT_RATE_LIMITED' });
    });

    it('rateLimiter.allow 返回 true → 落 pending 并返回 {taskId, traceId}', async () => {
      mockTaskRepo.save.mockImplementationOnce((e: Partial<CollectTaskEntity>) =>
        Promise.resolve({ ...e, id: 123 } as unknown as CollectTaskEntity),
      );
      const ctaskDto: CreateCollectTaskDto = {
        type: CollectTaskType.Comment,
        target: 'x',
        platform: 'douyin',
        sourceLevel: 'L1',
      };
      const result = await TenantContext.run({ traceId: 't6b', tenantId: 'tn-1' }, () =>
        svc.createCollectTask(ctaskDto),
      );

      expect(result.taskId).toBe(123);
      expect(typeof result.traceId).toBe('string');
      const created = mockTaskRepo.create.mock.calls[0][0] as unknown as CollectTaskEntity;
      expect(created.status).toBe(CollectTaskStatus.Pending);
      expect(created.tenantId).toBe('tn-1');
    });
  });

  // —— 验收点 7：createCollectTask 来源级别非法 ——
  describe('createCollectTask 来源级别校验', () => {
    it("sourceLevel='L3' → 抛 COLLECT_SOURCE_LEVEL_INVALID", async () => {
      const ctaskDto: CreateCollectTaskDto = {
        type: CollectTaskType.Comment,
        target: 'x',
        platform: 'douyin',
        sourceLevel: 'L3' as SourceLevel,
      };
      await expect(
        TenantContext.run({ traceId: 't7', tenantId: 'tn-1' }, () =>
          svc.createCollectTask(ctaskDto),
        ),
      ).rejects.toMatchObject({ code: 'COLLECT_SOURCE_LEVEL_INVALID' });
    });
  });

  // —— 验收点 8：getCollectTask 不存在/存在 ——
  describe('getCollectTask', () => {
    it('不存在 → 抛 COLLECT_TASK_NOT_FOUND', async () => {
      mockTaskRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        TenantContext.run({ traceId: 't8a', tenantId: 'tn-1' }, () => svc.getCollectTask(999)),
      ).rejects.toMatchObject({ code: 'COLLECT_TASK_NOT_FOUND' });
    });

    it('存在 → 返回 {status, progress, collectedCount}', async () => {
      mockTaskRepo.findOne.mockResolvedValueOnce({
        id: 7,
        tenantId: 'tn-1',
        status: CollectTaskStatus.Done,
        progress: 100,
        collectedCount: 3,
      } as unknown as CollectTaskEntity);

      const result = await TenantContext.run({ traceId: 't8b', tenantId: 'tn-1' }, () =>
        svc.getCollectTask(7),
      );

      expect(result).toMatchObject({
        status: CollectTaskStatus.Done,
        progress: 100,
        collectedCount: 3,
      });
    });
  });

  // —— 验收点 9：合规清洗（核心） ——
  describe('processPendingTasks 合规清洗', () => {
    it('3 条原始评论：正常/含手机/含广告 → 均落库且清洗结果正确，task 由 pending→done', async () => {
      const pendingTask = {
        id: 100,
        tenantId: 'tn-1',
        platform: 'douyin',
        status: CollectTaskStatus.Pending,
      } as unknown as CollectTaskEntity;
      mockTaskRepo.find.mockResolvedValueOnce([pendingTask]);
      fakeAdapter.fetchComments.mockResolvedValueOnce([
        { sourceRef: 'r1', content: '这个口红绝了' },
        { sourceRef: 'r2', content: '我的电话13800138000，方便联系' },
        { sourceRef: 'r3', content: '加微信 abc888 有内部价' },
      ]);
      mockCommentRepo.findOne.mockResolvedValue(null); // 无跨批次重复

      await svc.processPendingTasks();

      // 3 条均落库
      expect(mockCommentRepo.save).toHaveBeenCalledTimes(3);

      const saved = mockCommentRepo.save.mock.calls.map(
        (c: [Partial<CollectedCommentEntity>]) => c[0],
      ) as unknown as CollectedCommentEntity[];
      const normal = saved.find((s) => s.content.includes('口红'));
      const phone = saved.find((s) => s.content.includes('[已脱敏]'));
      const ad = saved.find((s) => s.content.includes('微信'));

      expect(normal).toBeDefined();
      expect(normal!.isClean).toBe(true);

      expect(phone).toBeDefined();
      expect(phone!.isClean).toBe(false);
      expect(phone!.cleanResult?.['piiRemoved']).toContain('phone');

      expect(ad).toBeDefined();
      expect(ad!.isClean).toBe(false);

      // task 状态 pending→done
      const taskSave = mockTaskRepo.save.mock.calls.map(
        (c: [Partial<CollectTaskEntity>]) => c[0],
      ) as unknown as CollectTaskEntity[];
      const finalTask = taskSave[taskSave.length - 1];
      expect(finalTask.status).toBe(CollectTaskStatus.Done);
      expect(finalTask.collectedCount).toBe(3);
      expect(finalTask.finishedAt).toBeInstanceOf(Date);
    });

    it('PII 多模式剥离：geo/imei/身份证/精确定位/个体画像均落库为 [已脱敏]', async () => {
      const pendingTask = {
        id: 150,
        tenantId: 'tn-1',
        platform: 'douyin',
        status: CollectTaskStatus.Pending,
      } as unknown as CollectTaskEntity;
      mockTaskRepo.find.mockResolvedValueOnce([pendingTask]);
      fakeAdapter.fetchComments.mockResolvedValueOnce([
        { sourceRef: 'g1', content: '我在北京市朝阳区' },
        { sourceRef: 'g2', content: 'imei 123456789012345' },
        { sourceRef: 'g3', content: '身份证 110101199001011234' },
        { sourceRef: 'g4', content: '坐标 39.904200, 116.407400' },
        { sourceRef: 'g5', content: '身高 175cm 体重 70kg' },
      ]);
      mockCommentRepo.findOne.mockResolvedValue(null); // 无跨批次重复

      await svc.processPendingTasks();

      expect(mockCommentRepo.save).toHaveBeenCalledTimes(5);
      const saved = mockCommentRepo.save.mock.calls.map(
        (c: [Partial<CollectedCommentEntity>]) => c[0],
      ) as unknown as CollectedCommentEntity[];
      for (const s of saved) {
        expect(s.content).toContain('[已脱敏]');
        expect(s.isClean).toBe(false);
      }
      const removed = saved.map((s) => s.cleanResult?.['piiRemoved'] as string[]).flat();
      expect(removed).toEqual(
        expect.arrayContaining([
          'geo',
          'imei',
          'id_card',
          'precise_location',
          'individual_profile',
        ]),
      );
    });
  });

  // —— 验收点 10：去重（批内） ——
  describe('storeCleanComments 去重', () => {
    it('同一批两条 sourceRef+content 相同 → 只落库 1 条', async () => {
      const pendingTask = {
        id: 200,
        tenantId: 'tn-1',
        platform: 'douyin',
        status: CollectTaskStatus.Pending,
      } as unknown as CollectTaskEntity;
      mockTaskRepo.find.mockResolvedValueOnce([pendingTask]);
      fakeAdapter.fetchComments.mockResolvedValueOnce([
        { sourceRef: 'dup', content: '重复评论' },
        { sourceRef: 'dup', content: '重复评论' },
      ]);
      mockCommentRepo.findOne.mockResolvedValue(null); // 无跨批次重复

      await svc.processPendingTasks();

      expect(mockCommentRepo.save).toHaveBeenCalledTimes(1);
    });

    it('跨批次去重：同 contentHash 已落库 → 跳过，不再入库', async () => {
      const pendingTask = {
        id: 250,
        tenantId: 'tn-1',
        platform: 'douyin',
        status: CollectTaskStatus.Pending,
      } as unknown as CollectTaskEntity;
      mockTaskRepo.find.mockResolvedValueOnce([pendingTask]);
      fakeAdapter.fetchComments.mockResolvedValueOnce([{ sourceRef: 'r99', content: '重复评论' }]);
      mockCommentRepo.findOne.mockResolvedValueOnce({
        id: 9,
        tenantId: 'tn-1',
        contentHash: 'x',
      } as unknown as CollectedCommentEntity); // 跨批次已存在

      await svc.processPendingTasks();

      expect(mockCommentRepo.save).toHaveBeenCalledTimes(0);
    });
  });

  // —— 验收点 11：processPendingTasks 失败路径 ——
  describe('processPendingTasks 失败路径', () => {
    it('适配器 fetchComments 抛错 → task 状态变 failed，errorMsg 被记录', async () => {
      const pendingTask = {
        id: 300,
        tenantId: 'tn-1',
        platform: 'douyin',
        status: CollectTaskStatus.Pending,
      } as unknown as CollectTaskEntity;
      mockTaskRepo.find.mockResolvedValueOnce([pendingTask]);
      fakeAdapter.fetchComments.mockRejectedValueOnce(new Error('adapter boom'));

      await svc.processPendingTasks();

      const taskSave = mockTaskRepo.save.mock.calls.map(
        (c: [Partial<CollectTaskEntity>]) => c[0],
      ) as unknown as CollectTaskEntity[];
      const finalTask = taskSave[taskSave.length - 1];
      expect(finalTask.status).toBe(CollectTaskStatus.Failed);
      expect(finalTask.errorMsg).toBe('adapter boom');
      expect(finalTask.finishedAt).toBeInstanceOf(Date);
    });
  });

  // —— 验收点 12：mineKeywords / getHot ——
  describe('mineKeywords / getHot', () => {
    it('mineKeywords 返回 adapter.mineKeywords 的结果 string[]', async () => {
      fakeAdapter.mineKeywords.mockResolvedValueOnce(['a', 'b']);
      const kmDto: KeywordMineDto = { platform: 'douyin', target: 'x' };
      const result = await TenantContext.run({ traceId: 't12a', tenantId: 'tn-1' }, () =>
        svc.mineKeywords(kmDto),
      );
      expect(result).toEqual(['a', 'b']);
    });

    it('getHot 抓取热点后 hotRepo.save 被调用，find 返回数组', async () => {
      fakeAdapter.fetchHot.mockResolvedValueOnce([
        { hotType: HotType.Video, title: '热点1', heat: 100, url: 'http://x' },
      ]);
      mockHotRepo.find.mockResolvedValueOnce([
        { id: 1, tenantId: 'tn-1', platform: 'douyin', title: '热点1' },
      ] as unknown as HotSnapshotEntity[]);

      const result = await TenantContext.run({ traceId: 't12b', tenantId: 'tn-1' }, () =>
        svc.getHot('douyin', HotType.Video),
      );

      expect(mockHotRepo.save).toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('getHot 无平台参数：命中 Redis 缓存则不查库', async () => {
      const cached = [{ id: 9, tenantId: 'tn-1', title: '缓存热点' }];
      mockRedis.getJson.mockResolvedValueOnce(cached);
      mockHotRepo.find.mockResolvedValueOnce([]);

      const result = await TenantContext.run({ traceId: 't12c', tenantId: 'tn-1' }, () =>
        svc.getHot(),
      );

      expect(mockHotRepo.find).not.toHaveBeenCalled();
      expect(result.length).toBe(1);
      expect(result[0].title).toBe('缓存热点');
    });

    it('getHot 无平台参数：缓存未命中则查库并回填缓存（TTL 60s）', async () => {
      mockRedis.getJson.mockResolvedValueOnce(null);
      const rows = [{ id: 3, tenantId: 'tn-1', title: 'DB热点' }];
      mockHotRepo.find.mockResolvedValueOnce(rows as unknown as HotSnapshotEntity[]);

      const result = await TenantContext.run({ traceId: 't12d', tenantId: 'tn-1' }, () =>
        svc.getHot(),
      );

      expect(mockHotRepo.find).toHaveBeenCalledTimes(1);
      expect(result.length).toBe(1);
      expect(mockRedis.setJson).toHaveBeenCalledWith(
        'intel:hot:tn-1:video',
        rows,
        expect.any(Number),
      );
    });

    it('getHot 抓取后失效缓存键（下次读库回填）', async () => {
      fakeAdapter.fetchHot.mockResolvedValueOnce([]);
      await TenantContext.run({ traceId: 't12e', tenantId: 'tn-1' }, () =>
        svc.getHot('douyin', HotType.Video),
      );
      expect(mockRedis.del).toHaveBeenCalledWith('intel:hot:tn-1:video');
    });
  });

  // —— 附加：无 TenantContext 调用应抛 TENANT_REQUIRED ——
  describe('租户上下文缺失防护', () => {
    it('未包裹 TenantContext.run 调用 createCompetitor → 抛 TENANT_REQUIRED', async () => {
      const dto: CreateCompetitorDto = { platform: 'douyin', name: 'x' };
      await expect(svc.createCompetitor(dto)).rejects.toMatchObject({
        code: 'TENANT_REQUIRED',
      });
    });
  });

  // —— 验收点 13：采集源配置 CRUD ——
  describe('采集源配置（createSource/listSources/updateSource/removeSource）', () => {
    it('createSource：默认 enabled=true、collectCount=0、清洗全开，可覆盖 cleaning', async () => {
      const result = await TenantContext.run({ traceId: 't13a', tenantId: 'tn-1' }, () =>
        svc.createSource({
          name: '抖音公开搜索',
          platform: 'douyin',
          sourceType: 'keyword',
          target: '护肤',
          mode: 'search',
          cleaning: { reviewRequired: true },
        }),
      );
      expect(result.tenantId).toBe('tn-1');
      expect(result.enabled).toBe(true);
      expect(result.collectCount).toBe(0);
      expect(result.cleaning).toMatchObject({
        dedup: true,
        piiStrip: true,
        adFilter: true,
        reviewRequired: true,
      });
      expect(mockSourceRepo.create.mock.calls[0][0].tenantId).toBe('tn-1');
    });

    it('listSources 按 tenantId 过滤并按 createdAt 倒序', async () => {
      mockSourceRepo.find.mockResolvedValueOnce([]);
      await TenantContext.run({ traceId: 't13b', tenantId: 'tn-1' }, () => svc.listSources());
      expect(mockSourceRepo.find.mock.calls[0][0]).toMatchObject({
        where: { tenantId: 'tn-1' },
        order: { createdAt: 'DESC' },
      });
    });

    it('updateSource：只更新传入字段，清洗按 DEFAULT 合并', async () => {
      mockSourceRepo.findOne.mockResolvedValueOnce({
        id: 3,
        tenantId: 'tn-1',
        name: 'old',
        cleaning: { dedup: true, piiStrip: true, adFilter: true, reviewRequired: false },
      } as unknown as CollectSourceEntity);
      const result = await TenantContext.run({ traceId: 't13c', tenantId: 'tn-1' }, () =>
        svc.updateSource(3, { name: 'new-name', enabled: false }),
      );
      expect(result.name).toBe('new-name');
      expect(result.enabled).toBe(false);
      expect(result.cleaning).toMatchObject({ dedup: true, reviewRequired: false });
    });

    it('updateSource 不存在 → COLLECT_SOURCE_NOT_FOUND', async () => {
      mockSourceRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        TenantContext.run({ traceId: 't13d', tenantId: 'tn-1' }, () =>
          svc.updateSource(99, { name: 'x' }),
        ),
      ).rejects.toMatchObject({ code: 'COLLECT_SOURCE_NOT_FOUND' });
    });

    it('removeSource 软删除并返回 id', async () => {
      mockSourceRepo.findOne.mockResolvedValueOnce({
        id: 3,
        tenantId: 'tn-1',
      } as unknown as CollectSourceEntity);
      const result = await TenantContext.run({ traceId: 't13e', tenantId: 'tn-1' }, () =>
        svc.removeSource(3),
      );
      expect(result).toEqual({ id: 3 });
      expect(mockSourceRepo.softDelete).toHaveBeenCalledWith({ id: 3, tenantId: 'tn-1' });
    });
  });

  // —— 验收点 14：由采集源发起采集（继承配置） ——
  describe('collectFromSource', () => {
    it('继承源配置：type/target/platform/sourceLevel/sourceId/cleaning/config 全部回填任务', async () => {
      mockSourceRepo.findOne.mockResolvedValueOnce({
        id: 3,
        tenantId: 'tn-1',
        sourceType: 'keyword',
        target: '面膜',
        platform: 'xiaohongshu',
        enabled: true,
        rateLimit: 5,
        cleaning: { dedup: false, reviewRequired: true },
        config: { region: 'cn' },
      } as unknown as CollectSourceEntity);
      mockTaskRepo.save.mockResolvedValueOnce({
        id: 55,
        tenantId: 'tn-1',
      } as unknown as CollectTaskEntity);

      const result = await TenantContext.run({ traceId: 't14a', tenantId: 'tn-1' }, () =>
        svc.collectFromSource(3),
      );

      expect(result.taskId).toBeDefined();
      const created = mockTaskRepo.create.mock.calls[0][0];
      expect(created).toMatchObject({
        type: CollectTaskType.Keyword,
        target: '面膜',
        platform: 'xiaohongshu',
        sourceLevel: 'L2',
        sourceId: 3,
        cleaning: { dedup: false, reviewRequired: true },
        config: { region: 'cn' },
      });
      expect(mockTaskRepo.save).toHaveBeenCalled();
    });

    it('源不存在 → COLLECT_SOURCE_NOT_FOUND', async () => {
      mockSourceRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        TenantContext.run({ traceId: 't14b', tenantId: 'tn-1' }, () => svc.collectFromSource(9)),
      ).rejects.toMatchObject({ code: 'COLLECT_SOURCE_NOT_FOUND' });
    });

    it('源被禁用 → COLLECT_SOURCE_DISABLED，且不创建任务', async () => {
      mockSourceRepo.findOne.mockResolvedValueOnce({
        id: 3,
        tenantId: 'tn-1',
        enabled: false,
      } as unknown as CollectSourceEntity);
      await expect(
        TenantContext.run({ traceId: 't14c', tenantId: 'tn-1' }, () => svc.collectFromSource(3)),
      ).rejects.toMatchObject({ code: 'COLLECT_SOURCE_DISABLED' });
      expect(mockTaskRepo.create).not.toHaveBeenCalled();
    });
  });

  // —— 验收点 15：任务生命周期控制 ——
  describe('controlCollectTask', () => {
    it('pause：pending → paused，记录 pausedAt', async () => {
      mockTaskRepo.findOne.mockResolvedValueOnce({
        id: 5,
        tenantId: 'tn-1',
        status: CollectTaskStatus.Pending,
      } as unknown as CollectTaskEntity);
      const result = await TenantContext.run({ traceId: 't15a', tenantId: 'tn-1' }, () =>
        svc.controlCollectTask(5, CollectControlAction.Pause),
      );
      expect(result.status).toBe(CollectTaskStatus.Paused);
      expect(result.pausedAt).toBeInstanceOf(Date);
    });

    it('resume：paused → pending，pausedAt 清空', async () => {
      mockTaskRepo.findOne.mockResolvedValueOnce({
        id: 5,
        tenantId: 'tn-1',
        status: CollectTaskStatus.Paused,
      } as unknown as CollectTaskEntity);
      const result = await TenantContext.run({ traceId: 't15b', tenantId: 'tn-1' }, () =>
        svc.controlCollectTask(5, CollectControlAction.Resume),
      );
      expect(result.status).toBe(CollectTaskStatus.Pending);
      expect(result.pausedAt).toBeUndefined();
    });

    it('cancel：running → cancelled，记录 finishedAt', async () => {
      mockTaskRepo.findOne.mockResolvedValueOnce({
        id: 5,
        tenantId: 'tn-1',
        status: CollectTaskStatus.Running,
      } as unknown as CollectTaskEntity);
      const result = await TenantContext.run({ traceId: 't15c', tenantId: 'tn-1' }, () =>
        svc.controlCollectTask(5, CollectControlAction.Cancel),
      );
      expect(result.status).toBe(CollectTaskStatus.Cancelled);
      expect(result.finishedAt).toBeInstanceOf(Date);
    });

    it('retry：failed → pending，retryCount+1，errorMsg/finishedAt 清空', async () => {
      mockTaskRepo.findOne.mockResolvedValueOnce({
        id: 5,
        tenantId: 'tn-1',
        status: CollectTaskStatus.Failed,
        retryCount: 1,
        errorMsg: 'boom',
        finishedAt: new Date(),
      } as unknown as CollectTaskEntity);
      const result = await TenantContext.run({ traceId: 't15d', tenantId: 'tn-1' }, () =>
        svc.controlCollectTask(5, CollectControlAction.Retry),
      );
      expect(result.status).toBe(CollectTaskStatus.Pending);
      expect(result.retryCount).toBe(2);
      expect(result.errorMsg).toBeUndefined();
      expect(result.finishedAt).toBeUndefined();
    });

    it('done 任务不可暂停 → COLLECT_TASK_STATE_INVALID', async () => {
      mockTaskRepo.findOne.mockResolvedValueOnce({
        id: 5,
        tenantId: 'tn-1',
        status: CollectTaskStatus.Done,
      } as unknown as CollectTaskEntity);
      await expect(
        TenantContext.run({ traceId: 't15e', tenantId: 'tn-1' }, () =>
          svc.controlCollectTask(5, CollectControlAction.Pause),
        ),
      ).rejects.toMatchObject({ code: 'COLLECT_TASK_STATE_INVALID' });
    });

    it('任务不存在 → COLLECT_TASK_NOT_FOUND', async () => {
      mockTaskRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        TenantContext.run({ traceId: 't15f', tenantId: 'tn-1' }, () =>
          svc.controlCollectTask(5, CollectControlAction.Pause),
        ),
      ).rejects.toMatchObject({ code: 'COLLECT_TASK_NOT_FOUND' });
    });
  });

  // —— 验收点 16：工作器跳过 暂停/取消，running 中取消弃结果 ——
  describe('processPendingTasks 生命周期协作', () => {
    it('paused 任务不进入工作器队列（不 resolve 适配器）', async () => {
      mockTaskRepo.find.mockResolvedValueOnce([]);
      await svc.processPendingTasks();
      expect(fakeAdapter.fetchComments).not.toHaveBeenCalled();
    });

    it('取数期间被 cancel：弃结果不落库，任务保持 cancelled', async () => {
      const pendingTask = {
        id: 400,
        tenantId: 'tn-1',
        platform: 'douyin',
        status: CollectTaskStatus.Pending,
      } as unknown as CollectTaskEntity;
      mockTaskRepo.find.mockResolvedValueOnce([pendingTask]);
      fakeAdapter.fetchComments.mockResolvedValueOnce([
        { sourceRef: 'r1', content: '本应被丢弃的评论' },
      ]);
      mockTaskRepo.findOne.mockResolvedValueOnce({
        id: 400,
        tenantId: 'tn-1',
        status: CollectTaskStatus.Cancelled,
      } as unknown as CollectTaskEntity);

      await svc.processPendingTasks();

      expect(mockCommentRepo.save).not.toHaveBeenCalled();
    });

    it('done 后回写源统计：collectCount 累加、lastCollectedAt 更新', async () => {
      const pendingTask = {
        id: 401,
        tenantId: 'tn-1',
        platform: 'douyin',
        status: CollectTaskStatus.Pending,
        sourceId: 3,
      } as unknown as CollectTaskEntity;
      mockTaskRepo.find.mockResolvedValueOnce([pendingTask]);
      fakeAdapter.fetchComments.mockResolvedValueOnce([{ sourceRef: 'r1', content: '评论A' }]);
      mockCommentRepo.findOne.mockResolvedValue(null);
      mockTaskRepo.findOne.mockResolvedValueOnce(pendingTask);
      mockSourceRepo.findOne.mockResolvedValueOnce({
        id: 3,
        tenantId: 'tn-1',
        collectCount: 10,
      } as unknown as CollectSourceEntity);

      await svc.processPendingTasks();

      expect(mockSourceRepo.save).toHaveBeenCalled();
      const sourceSaved = mockSourceRepo.save.mock.calls.map(
        (c: [Partial<CollectSourceEntity>]) => c[0],
      ) as unknown as CollectSourceEntity[];
      expect(sourceSaved[sourceSaved.length - 1].collectCount).toBe(11);
    });
  });

  // —— 验收点 17：清洗开关组合 ——
  describe('清洗开关（reviewRequired/dedup/piiStrip）', () => {
    it('reviewRequired=true → 评论落库 review_status=pending（送人工审核）', async () => {
      const pendingTask = {
        id: 500,
        tenantId: 'tn-1',
        platform: 'douyin',
        status: CollectTaskStatus.Pending,
        cleaning: {
          dedup: true,
          piiStrip: true,
          adFilter: true,
          reviewRequired: true,
        },
      } as unknown as CollectTaskEntity;
      mockTaskRepo.find.mockResolvedValueOnce([pendingTask]);
      fakeAdapter.fetchComments.mockResolvedValueOnce([{ sourceRef: 'r1', content: '正常评论' }]);
      mockCommentRepo.findOne.mockResolvedValue(null);

      await svc.processPendingTasks();

      const saved = mockCommentRepo.save.mock.calls.map(
        (c: [Partial<CollectedCommentEntity>]) => c[0],
      ) as unknown as CollectedCommentEntity[];
      expect(saved[0].reviewStatus).toBe(CommentReviewStatus.Pending);
    });

    it('reviewRequired=false（默认）→ 评论直接 approved', async () => {
      const pendingTask = {
        id: 501,
        tenantId: 'tn-1',
        platform: 'douyin',
        status: CollectTaskStatus.Pending,
        cleaning: {
          dedup: true,
          piiStrip: true,
          adFilter: true,
          reviewRequired: false,
        },
      } as unknown as CollectTaskEntity;
      mockTaskRepo.find.mockResolvedValueOnce([pendingTask]);
      fakeAdapter.fetchComments.mockResolvedValueOnce([{ sourceRef: 'r1', content: '正常评论' }]);
      mockCommentRepo.findOne.mockResolvedValue(null);

      await svc.processPendingTasks();

      const saved = mockCommentRepo.save.mock.calls.map(
        (c: [Partial<CollectedCommentEntity>]) => c[0],
      ) as unknown as CollectedCommentEntity[];
      expect(saved[0].reviewStatus).toBe(CommentReviewStatus.Approved);
    });

    it('piiStrip=false → 手机号保留不脱敏', async () => {
      const pendingTask = {
        id: 502,
        tenantId: 'tn-1',
        platform: 'douyin',
        status: CollectTaskStatus.Pending,
        cleaning: { dedup: true, piiStrip: false, adFilter: true, reviewRequired: false },
      } as unknown as CollectTaskEntity;
      mockTaskRepo.find.mockResolvedValueOnce([pendingTask]);
      fakeAdapter.fetchComments.mockResolvedValueOnce([
        { sourceRef: 'r1', content: '电话13800138000' },
      ]);
      mockCommentRepo.findOne.mockResolvedValue(null);

      await svc.processPendingTasks();

      const saved = mockCommentRepo.save.mock.calls.map(
        (c: [Partial<CollectedCommentEntity>]) => c[0],
      ) as unknown as CollectedCommentEntity[];
      expect(saved[0].content).toContain('13800138000');
    });

    it('dedup=false → 同 sourceRef+content 重复也入库', async () => {
      const pendingTask = {
        id: 503,
        tenantId: 'tn-1',
        platform: 'douyin',
        status: CollectTaskStatus.Pending,
        cleaning: { dedup: false, piiStrip: true, adFilter: true, reviewRequired: false },
      } as unknown as CollectTaskEntity;
      mockTaskRepo.find.mockResolvedValueOnce([pendingTask]);
      fakeAdapter.fetchComments.mockResolvedValueOnce([
        { sourceRef: 'dup', content: '重复评论' },
        { sourceRef: 'dup', content: '重复评论' },
      ]);
      mockCommentRepo.findOne.mockResolvedValue(null);

      await svc.processPendingTasks();

      expect(mockCommentRepo.save).toHaveBeenCalledTimes(2);
    });
  });

  // —— 验收点 18：评论审核（单条 + 批量） ——
  describe('reviewComment / reviewCommentsBatch', () => {
    it('单条：pending → approved 后落库', async () => {
      mockCommentRepo.findOne.mockResolvedValueOnce({
        id: 9,
        tenantId: 'tn-1',
        reviewStatus: CommentReviewStatus.Pending,
      } as unknown as CollectedCommentEntity);
      const result = await TenantContext.run({ traceId: 't18a', tenantId: 'tn-1' }, () =>
        svc.reviewComment(9, CommentReviewStatus.Approved),
      );
      expect(result.reviewStatus).toBe(CommentReviewStatus.Approved);
      expect(mockCommentRepo.save).toHaveBeenCalled();
    });

    it('评论不存在 → COMMENT_NOT_FOUND', async () => {
      mockCommentRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        TenantContext.run({ traceId: 't18b', tenantId: 'tn-1' }, () =>
          svc.reviewComment(9, CommentReviewStatus.Approved),
        ),
      ).rejects.toMatchObject({ code: 'COMMENT_NOT_FOUND' });
    });

    it('非法审核状态 → COMMENT_REVIEW_INVALID', async () => {
      mockCommentRepo.findOne.mockResolvedValueOnce({
        id: 9,
        tenantId: 'tn-1',
      } as unknown as CollectedCommentEntity);
      await expect(
        TenantContext.run({ traceId: 't18c', tenantId: 'tn-1' }, () =>
          svc.reviewComment(9, 'whatever' as CommentReviewStatus),
        ),
      ).rejects.toMatchObject({ code: 'COMMENT_REVIEW_INVALID' });
    });

    it('批量：update 按 ids+tenantId 条件执行，返回 updated 数', async () => {
      (
        mockCommentRepo.update as jest.Mock<Promise<{ affected?: number }>, unknown[]>
      ).mockResolvedValueOnce({ affected: 2 });
      const result = await TenantContext.run({ traceId: 't18d', tenantId: 'tn-1' }, () =>
        svc.reviewCommentsBatch([7, 8], CommentReviewStatus.Rejected),
      );
      expect(result).toEqual({ updated: 2 });
      const [criteria, patch] = mockCommentRepo.update.mock.calls[0];
      expect(criteria['tenantId']).toBe('tn-1');
      expect((criteria['id'] as { _value: unknown[] })._value).toEqual([7, 8]);
      expect(patch).toEqual({ reviewStatus: CommentReviewStatus.Rejected });
    });

    it('批量：空 ids → updated=0 且不调 update', async () => {
      const result = await TenantContext.run({ traceId: 't18e', tenantId: 'tn-1' }, () =>
        svc.reviewCommentsBatch([], CommentReviewStatus.Approved),
      );
      expect(result).toEqual({ updated: 0 });
      expect(mockCommentRepo.update).not.toHaveBeenCalled();
    });
  });

  // —— 验收点 19：干净评论查询支持审核状态过滤 ——
  describe('findCleanComments', () => {
    it('传 reviewStatus 时 andWhere 带 review_status 条件，返回 buildPage 结构', async () => {
      await TenantContext.run({ traceId: 't19a', tenantId: 'tn-1' }, () =>
        svc.findCleanComments({ page: 1, pageSize: 10, reviewStatus: CommentReviewStatus.Pending }),
      );
      expect(qb.andWhere).toHaveBeenCalledWith('c.review_status = :reviewStatus', {
        reviewStatus: 'pending',
      });
      expect(qb.orderBy).toHaveBeenCalledWith('c.collected_at', 'DESC');
      expect(qb.getManyAndCount).toHaveBeenCalled();
    });

    it('不传 reviewStatus → 不加该条件', async () => {
      await TenantContext.run({ traceId: 't19b', tenantId: 'tn-1' }, () =>
        svc.findCleanComments({ page: 1, pageSize: 10 }),
      );
      const calls = qb.andWhere.mock.calls.map((c) => c[0]);
      expect(calls).not.toContain('c.review_status = :reviewStatus');
    });
  });
});
