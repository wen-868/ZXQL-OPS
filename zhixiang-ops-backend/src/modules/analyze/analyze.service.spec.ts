import { AnalyzeService } from './analyze.service';
import { TenantContext } from '../../tenant/tenant-context';
import { AnalysisTaskEntity } from './analysis-task.entity';
import { HumanInsightEntity } from './human-insight.entity';
import { CollectedCommentEntity } from '../intel/collected-comment.entity';
import { AnalysisStatus } from './analyze.types';
import { CreateAnalysisTaskDto } from './dto/create-analysis-task.dto';
import { CreateInsightDto } from './dto/create-insight.dto';
import { InsightQueryDto } from './dto/insight-query.dto';

/**
 * AnalyzeService（D 人性分析与洞察引擎）单元测试（规划 §4-D / R3 任务卡）。
 * 直接实例化 `new AnalyzeService(mockTaskRepo, mockInsightRepo, mockCommentRepo, mockSkill)`（不走 Nest DI）。
 * 所有业务调用用 `TenantContext.run({ traceId, tenantId }, () => svc.xxx())` 包裹，
 * 否则 service 内的 requireTenantId 会抛 TENANT_REQUIRED。
 */

// —— 测试辅助：构造链式 QueryBuilder mock ——
function buildQueryBuilder() {
  return {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getMany: jest.fn().mockResolvedValue([]),
  };
}

// —— 成功路径的聚类 JSON 内容（7×6 聚合）——
const CLUSTER_JSON = JSON.stringify({
  driverCounts: { 贪: 2, 懒: 1, 怕: 0, 虚荣: 0, 窥探: 0, 孤独爱: 0, 愤怒不公: 0 },
  emotionScores: { 愤怒: 0, 共鸣: 1, 好奇: 2, 感动: 0, 焦虑: 0, 爽感: 0 },
  topDrivers: ['贪'],
  topEmotions: ['好奇'],
  insights: [
    {
      category: '贪',
      driver: '贪',
      emotion: '好奇',
      title: '价格敏感',
      content: '用户关注性价比',
      tags: ['价格'],
    },
  ],
});

describe('AnalyzeService', () => {
  let svc: AnalyzeService;
  let mockTaskRepo: any;
  let mockInsightRepo: any;
  let mockCommentRepo: any;
  let mockSkill: any;
  let qb: ReturnType<typeof buildQueryBuilder>;

  beforeEach(() => {
    qb = buildQueryBuilder();
    mockTaskRepo = {
      create: jest.fn((e: Partial<AnalysisTaskEntity>) => e),
      save: jest.fn(async (e: any) => e),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };
    mockInsightRepo = {
      create: jest.fn((e: Partial<HumanInsightEntity>) => e),
      save: jest.fn(async (e: any) => e),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };
    mockCommentRepo = {
      create: jest.fn((e: Partial<CollectedCommentEntity>) => e),
      save: jest.fn(async (e: any) => e),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };
    mockSkill = {
      invoke: jest.fn().mockResolvedValue({
        content: CLUSTER_JSON,
        modelUsed: 'local-ollama',
        source: 'local-ollama',
      }),
    };

    svc = new AnalyzeService(mockTaskRepo, mockInsightRepo, mockCommentRepo, mockSkill);
  });

  // —— 验收点 1：createAnalysisTask 空输入 ——
  describe('createAnalysisTask 空输入', () => {
    it('无 clean 评论（getMany→[]）→ 抛 ANALYSIS_EMPTY_INPUT', async () => {
      qb.getMany.mockResolvedValueOnce([]);
      const dto: CreateAnalysisTaskDto = { platform: 'douyin', commentLimit: 200 };
      await expect(
        TenantContext.run({ traceId: 't1', tenantId: 'tn-1' }, () => svc.createAnalysisTask(dto)),
      ).rejects.toMatchObject({ code: 'ANALYSIS_EMPTY_INPUT' });
    });
  });

  // —— 验收点 2：createAnalysisTask 正常 ——
  describe('createAnalysisTask 正常', () => {
    it('3 条 is_clean 评论 → 落 pending 并返回 {taskId, traceId}', async () => {
      qb.getMany.mockResolvedValueOnce([
        { id: 1, content: 'a', tenantId: 'tn-1', isClean: true },
        { id: 2, content: 'b', tenantId: 'tn-1', isClean: true },
        { id: 3, content: 'c', tenantId: 'tn-1', isClean: true },
      ] as CollectedCommentEntity[]);
      mockTaskRepo.save.mockImplementationOnce(async (e: any) => ({ ...e, id: 42 }));

      const dto: CreateAnalysisTaskDto = { platform: 'douyin', commentLimit: 200 };
      const result = await TenantContext.run({ traceId: 't1', tenantId: 'tn-1' }, () =>
        svc.createAnalysisTask(dto),
      );

      expect(result.taskId).toBe(42);
      expect(typeof result.traceId).toBe('string');
      // taskRepo.create / save 被调用
      expect(mockTaskRepo.create).toHaveBeenCalled();
      expect(mockTaskRepo.save).toHaveBeenCalled();
      const created = mockTaskRepo.create.mock.calls[0][0] as AnalysisTaskEntity;
      expect(created.status).toBe(AnalysisStatus.Pending);
      expect(created.tenantId).toBe('tn-1');
    });
  });

  // —— 验收点 3：getAnalysisTask 不存在/存在 ——
  describe('getAnalysisTask', () => {
    it('不存在 → 抛 ANALYSIS_TASK_NOT_FOUND', async () => {
      mockTaskRepo.findOne.mockResolvedValueOnce(undefined);
      await expect(
        TenantContext.run({ traceId: 't3a', tenantId: 'tn-1' }, () => svc.getAnalysisTask(999)),
      ).rejects.toMatchObject({ code: 'ANALYSIS_TASK_NOT_FOUND' });
    });

    it('存在 → 返回实体', async () => {
      const entity = {
        id: 7,
        tenantId: 'tn-1',
        status: AnalysisStatus.Pending,
      } as AnalysisTaskEntity;
      mockTaskRepo.findOne.mockResolvedValueOnce(entity);
      const result = await TenantContext.run({ traceId: 't3b', tenantId: 'tn-1' }, () =>
        svc.getAnalysisTask(7),
      );
      expect(result.id).toBe(7);
      expect(mockTaskRepo.findOne.mock.calls[0][0]).toEqual({ where: { id: 7, tenantId: 'tn-1' } });
    });
  });

  // —— 验收点 4：processPendingAnalysis 成功路径 ——
  describe('processPendingAnalysis 成功路径', () => {
    it('pending 任务经聚类 → 状态 done，driverCounts/emotionScores/topDrivers/topEmotions/insights 回填，modelUsed 记 local-ollama，seedInsights 沉淀', async () => {
      const pendingTask = {
        id: 100,
        tenantId: 'tn-1',
        platform: 'douyin',
        status: AnalysisStatus.Pending,
      } as AnalysisTaskEntity;
      mockTaskRepo.find.mockResolvedValueOnce([pendingTask]);
      qb.getMany.mockResolvedValueOnce([
        { id: 1, content: '好便宜', tenantId: 'tn-1', isClean: true },
        { id: 2, content: '想看测评', tenantId: 'tn-1', isClean: true },
        { id: 3, content: '求链接', tenantId: 'tn-1', isClean: true },
      ] as CollectedCommentEntity[]);

      await svc.processPendingAnalysis();

      const taskSaves = mockTaskRepo.save.mock.calls.map(
        (c: any[]) => c[0],
      ) as AnalysisTaskEntity[];
      const finalTask = taskSaves[taskSaves.length - 1];
      expect(finalTask.status).toBe(AnalysisStatus.Done);
      expect(finalTask.driverCounts).toEqual({
        贪: 2,
        懒: 1,
        怕: 0,
        虚荣: 0,
        窥探: 0,
        孤独爱: 0,
        愤怒不公: 0,
      });
      expect(finalTask.emotionScores).toEqual({
        愤怒: 0,
        共鸣: 1,
        好奇: 2,
        感动: 0,
        焦虑: 0,
        爽感: 0,
      });
      expect(finalTask.topDrivers).toEqual(['贪']);
      expect(finalTask.topEmotions).toEqual(['好奇']);
      expect(Array.isArray(finalTask.insights)).toBe(true);
      expect(finalTask.insights!.length).toBeGreaterThanOrEqual(1);
      expect(finalTask.modelUsed).toBe('local-ollama');
      // seedInsights 沉淀：insightRepo.create / save 至少被调用
      expect(mockInsightRepo.create).toHaveBeenCalled();
      expect(mockInsightRepo.save).toHaveBeenCalled();
    });
  });

  // —— 验收点 5：JSON 容错（```json 围栏）——
  describe('processPendingAnalysis JSON 容错', () => {
    it('skill.invoke 返回 ```json 围栏包裹内容 → 仍能解析、任务 done', async () => {
      mockSkill.invoke.mockResolvedValueOnce({
        content: '```json\n' + CLUSTER_JSON + '\n```',
        modelUsed: 'local-ollama',
        source: 'local-ollama',
      });
      const pendingTask = {
        id: 101,
        tenantId: 'tn-1',
        platform: 'douyin',
        status: AnalysisStatus.Pending,
      } as AnalysisTaskEntity;
      mockTaskRepo.find.mockResolvedValueOnce([pendingTask]);
      qb.getMany.mockResolvedValueOnce([
        { id: 1, content: '好便宜', tenantId: 'tn-1', isClean: true },
      ] as CollectedCommentEntity[]);

      await svc.processPendingAnalysis();

      const taskSaves = mockTaskRepo.save.mock.calls.map(
        (c: any[]) => c[0],
      ) as AnalysisTaskEntity[];
      const finalTask = taskSaves[taskSaves.length - 1];
      expect(finalTask.status).toBe(AnalysisStatus.Done);
      expect(finalTask.topDrivers).toEqual(['贪']);
    });
  });

  // —— 验收点 6：processPendingAnalysis 失败路径 ——
  describe('processPendingAnalysis 失败路径', () => {
    it('skill.invoke 抛错 → task 状态变 failed，errorMsg 被记录', async () => {
      mockSkill.invoke.mockRejectedValueOnce(new Error('boom'));
      const pendingTask = {
        id: 102,
        tenantId: 'tn-1',
        platform: 'douyin',
        status: AnalysisStatus.Pending,
      } as AnalysisTaskEntity;
      mockTaskRepo.find.mockResolvedValueOnce([pendingTask]);
      qb.getMany.mockResolvedValueOnce([
        { id: 1, content: 'x', tenantId: 'tn-1', isClean: true },
      ] as CollectedCommentEntity[]);

      await svc.processPendingAnalysis();

      const taskSaves = mockTaskRepo.save.mock.calls.map(
        (c: any[]) => c[0],
      ) as AnalysisTaskEntity[];
      const finalTask = taskSaves[taskSaves.length - 1];
      expect(finalTask.status).toBe(AnalysisStatus.Failed);
      expect(finalTask.errorMsg).toBe('boom');
    });
  });

  // —— 验收点 7：合规边界②（不落单条评论原文）——
  describe('合规边界② 不落单条评论原文', () => {
    it('task.driverCounts 是聚合计数而非评论列表，无 comments 字段', async () => {
      const pendingTask = {
        id: 103,
        tenantId: 'tn-1',
        platform: 'douyin',
        status: AnalysisStatus.Pending,
      } as AnalysisTaskEntity;
      mockTaskRepo.find.mockResolvedValueOnce([pendingTask]);
      qb.getMany.mockResolvedValueOnce([
        { id: 1, content: '好便宜的口红', tenantId: 'tn-1', isClean: true },
        { id: 2, content: '想看测评', tenantId: 'tn-1', isClean: true },
        { id: 3, content: '求链接', tenantId: 'tn-1', isClean: true },
      ] as CollectedCommentEntity[]);

      await svc.processPendingAnalysis();

      const taskSaves = mockTaskRepo.save.mock.calls.map(
        (c: any[]) => c[0],
      ) as AnalysisTaskEntity[];
      const finalTask = taskSaves[taskSaves.length - 1];
      expect(finalTask).not.toHaveProperty('comments');
      expect(typeof finalTask.driverCounts).toBe('object');
      expect(Array.isArray(finalTask.driverCounts)).toBe(false);

      // insightRepo 仅存聚合洞察结论（title/content），未带评论原文
      const insightSaves = mockInsightRepo.save.mock.calls.map(
        (c: any[]) => c[0],
      ) as HumanInsightEntity[];
      for (const ins of insightSaves) {
        expect(ins).toHaveProperty('title');
        expect(ins).toHaveProperty('content');
        expect(ins).not.toHaveProperty('comments');
      }
    });
  });

  // —— 验收点 8：createInsight 去重 ——
  describe('createInsight 去重', () => {
    it('已存在同 tenantId+title+driver → 不新增，usageCount 累加', async () => {
      const existing = {
        id: 5,
        tenantId: 'tn-1',
        category: '贪',
        driver: '贪',
        emotion: '好奇',
        title: '价格敏感',
        content: '旧内容',
        usageCount: 3,
      } as HumanInsightEntity;
      mockInsightRepo.findOne.mockResolvedValueOnce(existing);

      const dto: CreateInsightDto = {
        category: '贪',
        driver: '贪',
        emotion: '好奇',
        title: '价格敏感',
        content: '更新内容',
      };
      const result = await TenantContext.run({ traceId: 't8', tenantId: 'tn-1' }, () =>
        svc.createInsight(dto),
      );

      expect(mockInsightRepo.create).not.toHaveBeenCalled();
      expect(result.usageCount).toBe(4); // 3 + 1
      expect(mockInsightRepo.save).toHaveBeenCalled();
    });
  });

  // —— 验收点 9：createInsight 新建 ——
  describe('createInsight 新建', () => {
    it('不存在 → create + save 被调用，usageCount=1', async () => {
      mockInsightRepo.findOne.mockResolvedValueOnce(undefined);

      const dto: CreateInsightDto = {
        category: '贪',
        driver: '贪',
        emotion: '好奇',
        title: '价格敏感',
        content: '用户关注性价比',
        tags: ['价格'],
      };
      const result = await TenantContext.run({ traceId: 't9', tenantId: 'tn-1' }, () =>
        svc.createInsight(dto),
      );

      expect(mockInsightRepo.create).toHaveBeenCalled();
      expect(mockInsightRepo.save).toHaveBeenCalled();
      expect(result.usageCount).toBe(1);
    });
  });

  // —— 验收点 10：createInsight 校验 ——
  describe('createInsight 校验', () => {
    it("driver='非法' → 抛 HUMANITY_INVALID", async () => {
      const dto: CreateInsightDto = {
        category: 'x',
        driver: '非法',
        emotion: '好奇',
        title: 't',
        content: 'c',
      };
      await expect(
        TenantContext.run({ traceId: 't10a', tenantId: 'tn-1' }, () => svc.createInsight(dto)),
      ).rejects.toMatchObject({ code: 'HUMANITY_INVALID' });
    });

    it('driver 合法、emotion="非法" → 抛 EMOTION_INVALID', async () => {
      const dto: CreateInsightDto = {
        category: '贪',
        driver: '贪',
        emotion: '非法',
        title: 't',
        content: 'c',
      };
      await expect(
        TenantContext.run({ traceId: 't10b', tenantId: 'tn-1' }, () => svc.createInsight(dto)),
      ).rejects.toMatchObject({ code: 'EMOTION_INVALID' });
    });
  });

  // —— 验收点 11：listInsights ——
  describe('listInsights', () => {
    it('TenantContext.run 内调用 → where 带 i.tenant_id = :tenantId，返回 buildPage 结构', async () => {
      const rows = [
        { id: 1, tenantId: 'tn-1', title: '价格敏感', usageCount: 5 },
      ] as HumanInsightEntity[];
      qb.getManyAndCount.mockResolvedValueOnce([rows, 1]);

      const query = { page: 1, pageSize: 20 } as InsightQueryDto;
      const result = await TenantContext.run({ traceId: 't11', tenantId: 'tn-1' }, () =>
        svc.listInsights(query),
      );

      expect(qb.where).toHaveBeenCalledWith('i.tenant_id = :tenantId', { tenantId: 'tn-1' });
      expect(result).toEqual({ list: rows, total: 1, page: 1, pageSize: 20 });
    });
  });

  // —— 验收点 12：getReport 无 done 任务 ——
  describe('getReport 无 done 任务', () => {
    it('taskRepo.findOne 返回 undefined → 返回空聚合（无 recentTaskId）', async () => {
      mockTaskRepo.findOne.mockResolvedValueOnce(undefined);
      const result = await TenantContext.run({ traceId: 't12', tenantId: 'tn-1' }, () =>
        svc.getReport(),
      );
      expect(result).toEqual({
        topDrivers: [],
        topEmotions: [],
        driverCounts: {},
        emotionScores: {},
        insights: [],
      });
      expect(result.recentTaskId).toBeUndefined();
    });
  });

  // —— 验收点 13：getReport 有 done 任务 ——
  describe('getReport 有 done 任务', () => {
    it('taskRepo.findOne 返回 status=done 的任务 → 返回对应聚合（含 recentTaskId）', async () => {
      const doneTask = {
        id: 77,
        tenantId: 'tn-1',
        status: AnalysisStatus.Done,
        topDrivers: ['贪'],
        topEmotions: ['好奇'],
        driverCounts: { 贪: 2 },
        emotionScores: { 好奇: 2 },
        insights: [
          { category: '贪', driver: '贪', emotion: '好奇', title: 't', content: 'c', tags: [] },
        ],
      } as unknown as AnalysisTaskEntity;
      mockTaskRepo.findOne.mockResolvedValueOnce(doneTask);

      const result = await TenantContext.run({ traceId: 't13', tenantId: 'tn-1' }, () =>
        svc.getReport(),
      );

      expect(result.recentTaskId).toBe(77);
      expect(result.topDrivers).toEqual(['贪']);
      expect(result.driverCounts).toEqual({ 贪: 2 });
    });
  });

  // —— 验收点 14：跨租户隔离 ——
  describe('跨租户隔离', () => {
    it('不同 tenantId 的 TenantContext.run 下，传给 repo 的 where 参数 tenantId 正确', async () => {
      const whereCalls: Array<{ sql: string; param: any }> = [];
      qb.where.mockImplementation((sql: string, param: any) => {
        whereCalls.push({ sql, param });
        return qb;
      });

      // (1) createAnalysisTask：commentRepo.createQueryBuilder.where 参数（tenantId=tn-2）
      qb.getMany.mockResolvedValueOnce([
        { id: 1, content: 'x', tenantId: 'tn-2', isClean: true },
      ] as CollectedCommentEntity[]);
      mockTaskRepo.save.mockImplementationOnce(async (e: any) => ({ ...e, id: 1 }));
      await TenantContext.run({ traceId: 't14a', tenantId: 'tn-2' }, () =>
        svc.createAnalysisTask({ platform: 'douyin' }),
      );
      const commentWhere = whereCalls.find((w) => w.sql.startsWith('c.tenant_id'));
      expect(commentWhere?.param).toEqual({ tenantId: 'tn-2' });

      // (2) listInsights：insightRepo.createQueryBuilder.where 参数（tenantId=tn-3）
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      await TenantContext.run({ traceId: 't14b', tenantId: 'tn-3' }, () =>
        svc.listInsights({ page: 1, pageSize: 20 }),
      );
      const insightWhere = whereCalls.find((w) => w.sql.startsWith('i.tenant_id'));
      expect(insightWhere?.param).toEqual({ tenantId: 'tn-3' });

      // (3) getReport：taskRepo.findOne 的 where.tenantId 正确（tenantId=tn-4）
      mockTaskRepo.findOne.mockResolvedValueOnce(undefined);
      await TenantContext.run({ traceId: 't14c', tenantId: 'tn-4' }, () => svc.getReport());
      expect(mockTaskRepo.findOne.mock.calls[0][0].where.tenantId).toBe('tn-4');

      // (4) createAnalysisTask 正常路径落到 taskRepo.create 的 tenantId（tenantId=tn-5）
      qb.getMany.mockResolvedValueOnce([
        { id: 2, content: 'y', tenantId: 'tn-5', isClean: true },
      ] as CollectedCommentEntity[]);
      mockTaskRepo.save.mockImplementationOnce(async (e: any) => ({ ...e, id: 1 }));
      await TenantContext.run({ traceId: 't14d', tenantId: 'tn-5' }, () =>
        svc.createAnalysisTask({ platform: 'douyin' }),
      );
      const taskCreateCall = mockTaskRepo.create.mock.calls.find(
        (c: any[]) => c[0].tenantId === 'tn-5',
      );
      expect(taskCreateCall).toBeDefined();
    });
  });

  // —— 附加：无 TenantContext 调用应抛 TENANT_REQUIRED ——
  describe('租户上下文缺失防护', () => {
    it('未包裹 TenantContext.run 调用 createAnalysisTask → 抛 TENANT_REQUIRED', async () => {
      await expect(svc.createAnalysisTask({ platform: 'douyin' })).rejects.toMatchObject({
        code: 'TENANT_REQUIRED',
      });
    });
  });
});
