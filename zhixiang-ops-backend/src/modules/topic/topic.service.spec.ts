import { TopicService } from './topic.service';
import { TenantContext } from '../../tenant/tenant-context';
import { TopicEntity } from './topic.entity';
import { TopicStatus } from './topic.types';
import { HumanInsightEntity } from '../analyze/human-insight.entity';
import { AnalysisTaskEntity } from '../analyze/analysis-task.entity';
import { AccountEntity } from '../account/account.entity';
import { GenerateTopicsDto } from './dto/generate-topics.dto';
import { UpdateTopicDto } from './dto/update-topic.dto';
import { TopicQueryDto } from './dto/topic-query.dto';
import { AbVariantDto } from './dto/ab-variant.dto';
import { ScheduleTopicDto } from './dto/schedule-topic.dto';

/**
 * TopicService（E 选题引擎）单元测试（规划 §4-E / R4 任务卡）。
 * 直接实例化 `new TopicService(mockTopicRepo, mockInsightRepo, mockAnalysisRepo, mockAccountRepo)`（不走 Nest DI）。
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

function makeTopic(partial: Partial<TopicEntity> = {}): TopicEntity {
  return {
    id: partial.id ?? 1,
    tenantId: partial.tenantId ?? 'tn-1',
    attributionId: partial.attributionId ?? 'attr_tn-1_content_' + 'a'.repeat(32),
    title: partial.title ?? '默认标题',
    humanDriver: partial.humanDriver ?? '贪',
    emotion: partial.emotion ?? '好奇',
    formulaTags: partial.formulaTags,
    status: partial.status ?? TopicStatus.Idea,
    score: partial.score ?? 0,
    analysisId: partial.analysisId,
    abVariantOf: partial.abVariantOf,
    scheduledAt: partial.scheduledAt,
    accountId: partial.accountId,
    promptVersion: partial.promptVersion ?? 'v1',
    modelUsed: partial.modelUsed ?? '',
  } as TopicEntity;
}

describe('TopicService', () => {
  let svc: TopicService;
  let mockTopicRepo: any;
  let mockInsightRepo: any;
  let mockAnalysisRepo: any;
  let mockAccountRepo: any;
  let insightQb: ReturnType<typeof buildQueryBuilder>;
  let topicQb: ReturnType<typeof buildQueryBuilder>;

  beforeEach(() => {
    insightQb = buildQueryBuilder();
    topicQb = buildQueryBuilder();
    mockTopicRepo = {
      create: jest.fn((e: Partial<TopicEntity>) => e as TopicEntity),
      save: jest.fn(async (e: any) => e),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(topicQb),
    };
    mockInsightRepo = {
      create: jest.fn((e: Partial<HumanInsightEntity>) => e as HumanInsightEntity),
      save: jest.fn(async (e: any) => e),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(insightQb),
    };
    mockAnalysisRepo = {
      create: jest.fn((e: Partial<AnalysisTaskEntity>) => e as AnalysisTaskEntity),
      save: jest.fn(async (e: any) => e),
      findOne: jest.fn(),
    };
    mockAccountRepo = {
      create: jest.fn((e: Partial<AccountEntity>) => e as AccountEntity),
      save: jest.fn(async (e: any) => e),
      findOne: jest.fn(),
    };

    svc = new TopicService(mockTopicRepo, mockInsightRepo, mockAnalysisRepo, mockAccountRepo);
  });

  // —— 验收点 1：generateTopics 正常（消费 D 洞察库）——
  describe('generateTopics 正常消费洞察库', () => {
    it('2 条洞察 → create+save 调用 2 次，attributionId 合规，status=idea，score=50+usageCount*5', async () => {
      const rows = [
        {
          id: 1,
          tenantId: 'tn-1',
          category: '贪',
          driver: '贪',
          emotion: '好奇',
          title: '价格敏感',
          content: 'c1',
          tags: ['价格'],
          usageCount: 3,
        },
        {
          id: 2,
          tenantId: 'tn-1',
          category: '懒',
          driver: '懒',
          emotion: '共鸣',
          title: '一键搞定',
          content: 'c2',
          tags: ['便捷'],
          usageCount: 1,
        },
      ] as HumanInsightEntity[];
      insightQb.getMany.mockResolvedValueOnce(rows);
      mockTopicRepo.findOne.mockResolvedValue(undefined); // 无重复

      const dto: GenerateTopicsDto = {};
      const result = await TenantContext.run({ traceId: 't1', tenantId: 'tn-1' }, () =>
        svc.generateTopics(dto),
      );

      expect(result.topics.length).toBe(2);
      expect(mockTopicRepo.create).toHaveBeenCalledTimes(2);
      expect(mockTopicRepo.save).toHaveBeenCalledTimes(2);

      // attributionId 合规
      for (const t of result.topics) {
        expect(t.attributionId).toMatch(/^attr_[\w-]+_content_[0-9a-f]{32}$/);
        expect(t.status).toBe(TopicStatus.Idea);
      }
      // score 顺序应与 usageCount 降序一致：65(usageCount=3)、55(usageCount=1)
      expect(result.topics[0].score).toBe(65);
      expect(result.topics[1].score).toBe(55);

      // insightRepo.createQueryBuilder.where 带 tenant_id，且 orderBy usageCount DESC
      expect(insightQb.where).toHaveBeenCalledWith('i.tenant_id = :tenantId', { tenantId: 'tn-1' });
      expect(insightQb.orderBy).toHaveBeenCalledWith('i.usageCount', 'DESC');
    });
  });

  // —— 验收点 2：generateTopics 空洞察 ——
  describe('generateTopics 空洞察', () => {
    it('insightRepo.getMany 返回 [] → 返回 {topics:[], traceId}，不抛错，save 未被调用', async () => {
      insightQb.getMany.mockResolvedValueOnce([]);

      const dto: GenerateTopicsDto = {};
      const result = await TenantContext.run({ traceId: 't2', tenantId: 'tn-1' }, () =>
        svc.generateTopics(dto),
      );

      expect(result.topics).toEqual([]);
      expect(result.traceId).toBe('t2');
      expect(mockTopicRepo.save).not.toHaveBeenCalled();
    });
  });

  // —— 验收点 3：generateTopics 去重 ——
  describe('generateTopics 去重', () => {
    it('已存在同 tenantId+title+driver+emotion 的 topic → create 未被调用（跳过）', async () => {
      const rows = [
        {
          id: 1,
          tenantId: 'tn-1',
          category: '贪',
          driver: '贪',
          emotion: '好奇',
          title: '价格敏感',
          content: 'c1',
          tags: ['价格'],
          usageCount: 3,
        },
      ] as HumanInsightEntity[];
      insightQb.getMany.mockResolvedValueOnce(rows);
      mockTopicRepo.findOne.mockResolvedValueOnce(makeTopic({ id: 99 })); // 命中重复

      const dto: GenerateTopicsDto = {};
      const result = await TenantContext.run({ traceId: 't3', tenantId: 'tn-1' }, () =>
        svc.generateTopics(dto),
      );

      expect(result.topics.length).toBe(0);
      expect(mockTopicRepo.create).not.toHaveBeenCalled();
      expect(mockTopicRepo.save).not.toHaveBeenCalled();
    });
  });

  // —— 验收点 4：generateTopics 从 analysisId 生成 ——
  describe('generateTopics 从 analysisId 生成', () => {
    it('dto.analysisId=123，analysisRepo.findOne 返回含 1 条 insight 的任务 → 生成 1 条 topic（analysisId=123）', async () => {
      const analysis = {
        id: 123,
        tenantId: 'tn-1',
        status: 'done',
        insights: [{ driver: '贪', emotion: '好奇', title: 'x', content: 'c', tags: ['t'] }],
      } as unknown as AnalysisTaskEntity;
      mockAnalysisRepo.findOne.mockResolvedValueOnce(analysis);
      mockTopicRepo.findOne.mockResolvedValue(undefined);

      const dto: GenerateTopicsDto = { analysisId: 123 };
      const result = await TenantContext.run({ traceId: 't4', tenantId: 'tn-1' }, () =>
        svc.generateTopics(dto),
      );

      expect(result.topics.length).toBe(1);
      expect(mockTopicRepo.create).toHaveBeenCalledTimes(1);
      const created = mockTopicRepo.create.mock.calls[0][0] as TopicEntity;
      expect(created.analysisId).toBe(123);
      expect(result.topics[0].analysisId).toBe(123);
    });
  });

  // —— 验收点 5：generateTopics analysisId 不存在 ——
  describe('generateTopics analysisId 不存在', () => {
    it('analysisRepo.findOne 返回 undefined → 抛 ANALYSIS_TASK_NOT_FOUND', async () => {
      mockAnalysisRepo.findOne.mockResolvedValueOnce(undefined);

      const dto: GenerateTopicsDto = { analysisId: 123 };
      await expect(
        TenantContext.run({ traceId: 't5', tenantId: 'tn-1' }, () => svc.generateTopics(dto)),
      ).rejects.toMatchObject({ code: 'ANALYSIS_TASK_NOT_FOUND' });
    });
  });

  // —— 验收点 6：generateTopics 校验 ——
  describe('generateTopics 校验', () => {
    it("dto.driver='非法' → 抛 HUMANITY_INVALID", async () => {
      const dto: GenerateTopicsDto = { driver: '非法' };
      await expect(
        TenantContext.run({ traceId: 't6a', tenantId: 'tn-1' }, () => svc.generateTopics(dto)),
      ).rejects.toMatchObject({ code: 'HUMANITY_INVALID' });
    });

    it('driver 合法、emotion="非法" → 抛 EMOTION_INVALID', async () => {
      const dto: GenerateTopicsDto = { driver: '贪', emotion: '非法' };
      await expect(
        TenantContext.run({ traceId: 't6b', tenantId: 'tn-1' }, () => svc.generateTopics(dto)),
      ).rejects.toMatchObject({ code: 'EMOTION_INVALID' });
    });
  });

  // —— 验收点 7：getTopic 不存在/存在 ——
  describe('getTopic', () => {
    it('不存在 → 抛 TOPIC_NOT_FOUND', async () => {
      mockTopicRepo.findOne.mockResolvedValueOnce(undefined);
      await expect(
        TenantContext.run({ traceId: 't7a', tenantId: 'tn-1' }, () => svc.getTopic(999)),
      ).rejects.toMatchObject({ code: 'TOPIC_NOT_FOUND' });
    });

    it('存在 → 返回实体', async () => {
      const topic = makeTopic({ id: 7 });
      mockTopicRepo.findOne.mockResolvedValueOnce(topic);
      const result = await TenantContext.run({ traceId: 't7b', tenantId: 'tn-1' }, () =>
        svc.getTopic(7),
      );
      expect(result.id).toBe(7);
      expect(mockTopicRepo.findOne.mock.calls[0][0]).toEqual({
        where: { id: 7, tenantId: 'tn-1' },
      });
    });
  });

  // —— 验收点 8：updateTopic 正常 + 状态机合法 ——
  describe('updateTopic 正常 + 状态机合法', () => {
    it('status=idea 的 topic + dto={status:todo,score:80} → save 被调用、status=todo、score=80', async () => {
      const topic = makeTopic({ id: 1, status: TopicStatus.Idea });
      mockTopicRepo.findOne.mockResolvedValueOnce(topic);

      const dto: UpdateTopicDto = { status: 'todo', score: 80 };
      const result = await TenantContext.run({ traceId: 't8', tenantId: 'tn-1' }, () =>
        svc.updateTopic(1, dto),
      );

      expect(mockTopicRepo.save).toHaveBeenCalled();
      expect(result.status).toBe(TopicStatus.Todo);
      expect(result.score).toBe(80);
    });
  });

  // —— 验收点 9：updateTopic 非法状态流转 ——
  describe('updateTopic 非法状态流转', () => {
    it("status=idea 的 topic + dto.status='written'（跳过 todo）→ 抛 INVALID_STATUS_TRANSITION", async () => {
      const topic = makeTopic({ id: 1, status: TopicStatus.Idea });
      mockTopicRepo.findOne.mockResolvedValueOnce(topic);

      const dto: UpdateTopicDto = { status: 'written' };
      await expect(
        TenantContext.run({ traceId: 't9', tenantId: 'tn-1' }, () => svc.updateTopic(1, dto)),
      ).rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });
    });
  });

  // —— 验收点 10：updateTopic 原地流转 ——
  describe('updateTopic 原地流转', () => {
    it("status=idea 的 topic + dto.status='idea' → 抛 INVALID_STATUS_TRANSITION（canTransition 同态返回 false）", async () => {
      const topic = makeTopic({ id: 1, status: TopicStatus.Idea });
      mockTopicRepo.findOne.mockResolvedValueOnce(topic);

      const dto: UpdateTopicDto = { status: 'idea' };
      await expect(
        TenantContext.run({ traceId: 't10', tenantId: 'tn-1' }, () => svc.updateTopic(1, dto)),
      ).rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });
    });
  });

  // —— 验收点 11：updateTopic 校验 ——
  describe('updateTopic 校验', () => {
    it("humanDriver='非法' → 抛 HUMANITY_INVALID", async () => {
      const topic = makeTopic({ id: 1, status: TopicStatus.Idea });
      mockTopicRepo.findOne.mockResolvedValueOnce(topic);

      const dto: UpdateTopicDto = { humanDriver: '非法' };
      await expect(
        TenantContext.run({ traceId: 't11a', tenantId: 'tn-1' }, () => svc.updateTopic(1, dto)),
      ).rejects.toMatchObject({ code: 'HUMANITY_INVALID' });
    });

    it('humanDriver 合法、emotion="非法" → 抛 EMOTION_INVALID', async () => {
      const topic = makeTopic({ id: 1, status: TopicStatus.Idea });
      mockTopicRepo.findOne.mockResolvedValueOnce(topic);

      const dto: UpdateTopicDto = { humanDriver: '贪', emotion: '非法' };
      await expect(
        TenantContext.run({ traceId: 't11b', tenantId: 'tn-1' }, () => svc.updateTopic(1, dto)),
      ).rejects.toMatchObject({ code: 'EMOTION_INVALID' });
    });
  });

  // —— 验收点 12：createAbVariant 正常 ——
  describe('createAbVariant 正常', () => {
    it('base(status=idea, abVariantOf 空) → save 被调用；新 variant.abVariantOf=base.id，title 继承为 `${base.title} (A/B)`，标签继承，status=idea', async () => {
      const base = makeTopic({
        id: 10,
        status: TopicStatus.Idea,
        title: '基准选题',
        humanDriver: '贪',
        emotion: '好奇',
        formulaTags: ['价格'],
        abVariantOf: undefined,
      });
      mockTopicRepo.findOne.mockResolvedValueOnce(base);

      const dto: AbVariantDto = {};
      const result = await TenantContext.run({ traceId: 't12', tenantId: 'tn-1' }, () =>
        svc.createAbVariant(10, dto),
      );

      expect(mockTopicRepo.save).toHaveBeenCalled();
      expect(result.abVariantOf).toBe(10);
      expect(result.title).toBe('基准选题 (A/B)');
      expect(result.humanDriver).toBe('贪');
      expect(result.emotion).toBe('好奇');
      expect(result.formulaTags).toEqual(['价格']);
      expect(result.status).toBe(TopicStatus.Idea);
    });
  });

  // —— 验收点 13：createAbVariant 防环 ——
  describe('createAbVariant 防环', () => {
    it('base 的 abVariantOf 已非空（变体）→ 抛 INVALID_AB_VARIANT_CYCLE', async () => {
      const variant = makeTopic({ id: 20, status: TopicStatus.Idea, abVariantOf: 10 });
      mockTopicRepo.findOne.mockResolvedValueOnce(variant);

      const dto: AbVariantDto = {};
      await expect(
        TenantContext.run({ traceId: 't13', tenantId: 'tn-1' }, () => svc.createAbVariant(20, dto)),
      ).rejects.toMatchObject({ code: 'INVALID_AB_VARIANT_CYCLE' });
    });
  });

  // —— 验收点 14：createAbVariant 基准不存在 ——
  describe('createAbVariant 基准不存在', () => {
    it('topicRepo.findOne 返回 undefined → 抛 TOPIC_NOT_FOUND', async () => {
      mockTopicRepo.findOne.mockResolvedValueOnce(undefined);

      const dto: AbVariantDto = {};
      await expect(
        TenantContext.run({ traceId: 't14', tenantId: 'tn-1' }, () =>
          svc.createAbVariant(999, dto),
        ),
      ).rejects.toMatchObject({ code: 'TOPIC_NOT_FOUND' });
    });
  });

  // —— 验收点 15：scheduleTopic 正常 ——
  describe('scheduleTopic 正常', () => {
    it('status=idea（accountId 空）+ dto={scheduledAt, accountId:1} → save 被调用，scheduledAt 为 Date，accountId=1', async () => {
      const topic = makeTopic({ id: 1, status: TopicStatus.Idea });
      mockTopicRepo.findOne.mockResolvedValueOnce(topic);
      mockAccountRepo.findOne.mockResolvedValueOnce(makeAccount({ id: 1, tenantId: 'tn-1' }));

      const dto: ScheduleTopicDto = {
        scheduledAt: '2026-09-01T00:00:00Z',
        accountId: 1,
      };
      const result = await TenantContext.run({ traceId: 't15', tenantId: 'tn-1' }, () =>
        svc.scheduleTopic(1, dto),
      );

      expect(mockTopicRepo.save).toHaveBeenCalled();
      expect(result.scheduledAt instanceof Date).toBe(true);
      expect(result.accountId).toBe(1);
    });
  });

  // —— 验收点 16：scheduleTopic 账号不存在 ——
  describe('scheduleTopic 账号不存在', () => {
    it('topic 存在 + dto.accountId=999 + accountRepo.findOne 返回 undefined → 抛 SCHEDULE_ACCOUNT_NOT_FOUND', async () => {
      const topic = makeTopic({ id: 1, status: TopicStatus.Idea });
      mockTopicRepo.findOne.mockResolvedValueOnce(topic);
      mockAccountRepo.findOne.mockResolvedValueOnce(undefined);

      const dto: ScheduleTopicDto = {
        scheduledAt: '2026-09-01T00:00:00Z',
        accountId: 999,
      };
      await expect(
        TenantContext.run({ traceId: 't16', tenantId: 'tn-1' }, () => svc.scheduleTopic(1, dto)),
      ).rejects.toMatchObject({ code: 'SCHEDULE_ACCOUNT_NOT_FOUND' });
    });
  });

  // —— 验收点 17：scheduleTopic 终态不可排期 ——
  describe('scheduleTopic 终态不可排期', () => {
    it('status=published 的 topic → 抛 INVALID_STATUS_TRANSITION（查账号前拦截）', async () => {
      const topic = makeTopic({ id: 1, status: TopicStatus.Published });
      mockTopicRepo.findOne.mockResolvedValueOnce(topic);

      const dto: ScheduleTopicDto = {
        scheduledAt: '2026-09-01T00:00:00Z',
        accountId: 1,
      };
      await expect(
        TenantContext.run({ traceId: 't17a', tenantId: 'tn-1' }, () => svc.scheduleTopic(1, dto)),
      ).rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });
      // 查账号前拦截：accountRepo.findOne 不应被调用
      expect(mockAccountRepo.findOne).not.toHaveBeenCalled();
    });

    it('status=dead 的 topic → 抛 INVALID_STATUS_TRANSITION', async () => {
      const topic = makeTopic({ id: 1, status: TopicStatus.Dead });
      mockTopicRepo.findOne.mockResolvedValueOnce(topic);

      const dto: ScheduleTopicDto = {
        scheduledAt: '2026-09-01T00:00:00Z',
        accountId: 1,
      };
      await expect(
        TenantContext.run({ traceId: 't17b', tenantId: 'tn-1' }, () => svc.scheduleTopic(1, dto)),
      ).rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });
    });
  });

  // —— 验收点 18：listTopics 分页+过滤+排序 ——
  describe('listTopics 分页+过滤+排序', () => {
    it('TenantContext.run 内调用 → where 带 t.tenant_id，driver/status 过滤 andWhere，orderBy score DESC，返回 buildPage 结构', async () => {
      const rows = [makeTopic({ id: 1, score: 90 }), makeTopic({ id: 2, score: 70 })];
      topicQb.getManyAndCount.mockResolvedValueOnce([rows, 2]);

      const query: TopicQueryDto = {
        page: 1,
        pageSize: 20,
        driver: '贪',
        status: 'idea',
      };
      const result = await TenantContext.run({ traceId: 't18', tenantId: 'tn-1' }, () =>
        svc.listTopics(query),
      );

      expect(topicQb.where).toHaveBeenCalledWith('t.tenant_id = :tenantId', { tenantId: 'tn-1' });
      expect(topicQb.andWhere).toHaveBeenCalledWith('t.human_driver = :driver', { driver: '贪' });
      expect(topicQb.andWhere).toHaveBeenCalledWith('t.status = :status', { status: 'idea' });
      expect(topicQb.orderBy).toHaveBeenCalledWith('t.score', 'DESC');
      expect(result).toEqual({ list: rows, total: 2, page: 1, pageSize: 20 });
    });
  });

  // —— 验收点 19：跨租户隔离 ——
  describe('跨租户隔离', () => {
    it('不同 tenantId 下，repo 收到的 tenantId 参数正确', async () => {
      // (1) generateTopics：insightRepo.createQueryBuilder.where 带对应 tenant_id
      const whereCalls: Array<{ sql: string; param: any }> = [];
      insightQb.where.mockImplementation((sql: string, param: any) => {
        whereCalls.push({ sql, param });
        return insightQb;
      });
      insightQb.getMany.mockResolvedValue([]); // 空洞察，避免触发 topicRepo 写入
      await TenantContext.run({ traceId: 't19a', tenantId: 'tn-2' }, () => svc.generateTopics({}));
      const insightWhere = whereCalls.find((w) => w.sql.startsWith('i.tenant_id'));
      expect(insightWhere?.param).toEqual({ tenantId: 'tn-2' });

      // (2) listTopics：topicRepo.createQueryBuilder.where 带对应 tenant_id
      const tWhereCalls: Array<{ sql: string; param: any }> = [];
      topicQb.where.mockImplementation((sql: string, param: any) => {
        tWhereCalls.push({ sql, param });
        return topicQb;
      });
      topicQb.getManyAndCount.mockResolvedValue([[], 0]);
      await TenantContext.run({ traceId: 't19b', tenantId: 'tn-3' }, () =>
        svc.listTopics({ page: 1, pageSize: 20 }),
      );
      const topicListWhere = tWhereCalls.find((w) => w.sql.startsWith('t.tenant_id'));
      expect(topicListWhere?.param).toEqual({ tenantId: 'tn-3' });

      // (3) getTopic：topicRepo.findOne 的 where.tenantId 正确
      mockTopicRepo.findOne.mockResolvedValueOnce(makeTopic({ id: 5, tenantId: 'tn-4' }));
      await TenantContext.run({ traceId: 't19c', tenantId: 'tn-4' }, () => svc.getTopic(5));
      const getTopicCall = mockTopicRepo.findOne.mock.calls.find(
        (c: any[]) => c[0].where && c[0].where.id === 5,
      );
      expect(getTopicCall?.[0].where.tenantId).toBe('tn-4');
    });
  });

  // —— 附加：无 TenantContext 防护 ——
  describe('租户上下文缺失防护', () => {
    it('未包裹 TenantContext.run 调用 getTopic → 抛 TENANT_REQUIRED', async () => {
      await expect(svc.getTopic(1)).rejects.toMatchObject({ code: 'TENANT_REQUIRED' });
    });
  });
});

// —— 辅助：构造 AccountEntity（为隔离引用 account.entity 仅在需要时）——
function makeAccount(partial: Partial<AccountEntity> = {}): AccountEntity {
  return {
    id: partial.id ?? 1,
    tenantId: partial.tenantId ?? 'tn-1',
    platform: partial.platform ?? ('douyin' as any),
    platformAccountId: partial.platformAccountId ?? 'pa-1',
    nickname: partial.nickname,
    identity: partial.identity ?? ('matrix' as any),
    stage: partial.stage ?? ('nurturing' as any),
    status: partial.status ?? ('unsigned' as any),
    fansCount: partial.fansCount ?? 0,
    followCount: partial.followCount ?? 0,
    likeCount: partial.likeCount ?? 0,
  } as AccountEntity;
}
