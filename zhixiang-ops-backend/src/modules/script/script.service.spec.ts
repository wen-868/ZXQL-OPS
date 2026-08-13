import { ScriptService } from './script.service';
import { ScriptEntity } from './script.entity';
import { ComplianceHit, ComplianceLevel, ComplianceRisk, ScriptStatus } from './script.types';
import { TopicEntity } from '../topic/topic.entity';
import { TopicStatus } from '../topic/topic.types';
import { SkillGateway } from '../../skill/skill.gateway';
import { ComplianceService } from '../compliance/compliance.service';
import { Repository } from 'typeorm';
import { createMockRepo, MockRepo } from '../../test-utils/mock-repo';
import { TenantContext } from '../../tenant/tenant-context';
import { GenerateScriptDto } from './dto/generate-script.dto';
import { UpdateScriptDto } from './dto/update-script.dto';
import { ScriptQueryDto } from './dto/script-query.dto';
import { ComplianceCheckDto } from './dto/compliance-check.dto';
import { VersionScriptDto } from './dto/version-script.dto';
import { SCRIPT_TEMPLATES } from './script.types';

/**
 * ScriptService（F 脚本工坊）单元测试（规划 §4-F / R5 任务卡）。
 * 直接实例化 `new ScriptService(mockScriptRepo, mockTopicRepo, mockSkillGateway)`（不走 Nest DI）。
 * 所有业务调用用 `TenantContext.run({ traceId, tenantId }, () => svc.xxx())` 包裹，
 * 否则 service 内的 requireTenantId 会抛 TENANT_REQUIRED。
 */

const TENANT = 'tn-1';

/** 测试辅助：findOne mock 调用参数里的 where 形状（强类型，避免 any） */
type FindWhere = { id?: number; tenantId?: string; status?: string };
type FindOneCall = { where?: FindWhere };

/** 测试辅助：服务 mock 的最小强类型（属性为 jest.Mock 实例，避免 unbound-method） */
type MockSkillGateway = {
  invoke: jest.Mock<Promise<typeof SCRIPT_RESULT>, [unknown?]>;
  generateText: jest.Mock<Promise<string>, [unknown?]>;
};
type MockCompliance = {
  checkText: jest.Mock<Promise<ComplianceRisk>, [string]>;
};

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
    tenantId: partial.tenantId ?? TENANT,
    attributionId: partial.attributionId ?? 'attr_t1_content_abc',
    title: partial.title ?? '选题A',
    humanDriver: partial.humanDriver ?? '贪',
    emotion: partial.emotion ?? '好奇',
    formulaTags: partial.formulaTags ?? ['价格'],
    status: partial.status ?? ('idea' as TopicStatus),
    score: partial.score ?? 0,
    analysisId: partial.analysisId,
    abVariantOf: partial.abVariantOf,
    scheduledAt: partial.scheduledAt,
    accountId: partial.accountId,
    promptVersion: partial.promptVersion ?? 'v1',
    modelUsed: partial.modelUsed ?? '',
    createdAt: partial.createdAt ?? new Date('2025-01-01T00:00:00Z'),
    updatedAt: partial.updatedAt ?? new Date('2025-01-01T00:00:00Z'),
  } as TopicEntity;
}

function makeScript(partial: Partial<ScriptEntity> = {}): ScriptEntity {
  return {
    id: partial.id ?? 1,
    tenantId: partial.tenantId ?? TENANT,
    topicId: partial.topicId ?? 1,
    attributionId: partial.attributionId ?? 'attr_t1_content_abc',
    title: partial.title ?? '选题A',
    content: partial.content ?? '前3秒钩子\n正文内容',
    hook: partial.hook ?? '前3秒钩子',
    hookEmotion: partial.hookEmotion ?? '好奇',
    spokenTrack: partial.spokenTrack ?? [{ tsStart: 0, tsEnd: 30, text: '前3秒钩子\n正文内容' }],
    subtitleTrack: partial.subtitleTrack ?? [],
    templateId: partial.templateId ?? null,
    version: partial.version ?? 1,
    parentVersionId: partial.parentVersionId ?? null,
    status: partial.status ?? ScriptStatus.Draft,
    complianceRisk: partial.complianceRisk ?? {
      hits: [],
      level: 'none',
      checkedAt: '2025-01-01T00:00:00.000Z',
    },
    promptVersion: partial.promptVersion ?? 'v1',
    modelUsed: partial.modelUsed ?? 'ollama/llama3',
    createdAt: partial.createdAt ?? new Date('2025-01-01T00:00:00Z'),
    updatedAt: partial.updatedAt ?? new Date('2025-01-01T00:00:00Z'),
  } as ScriptEntity;
}

const SCRIPT_CONTENT_OK = '前3秒钩子\n正文内容';
const SCRIPT_RESULT = { content: SCRIPT_CONTENT_OK, modelUsed: 'ollama/llama3', source: 'ollama' };

describe('ScriptService', () => {
  let svc: ScriptService;
  let mockScriptRepo: MockRepo<ScriptEntity>;
  let mockTopicRepo: MockRepo<TopicEntity>;
  let mockSkillGateway: MockSkillGateway;
  let mockCompliance: MockCompliance;
  let qb: ReturnType<typeof buildQueryBuilder>;

  beforeEach(() => {
    qb = buildQueryBuilder();
    mockScriptRepo = createMockRepo<ScriptEntity>();
    mockScriptRepo.createQueryBuilder.mockReturnValue(qb);
    mockTopicRepo = createMockRepo<TopicEntity>();
    mockTopicRepo.createQueryBuilder.mockReturnValue(buildQueryBuilder());
    mockSkillGateway = {
      invoke: jest.fn(() => Promise.resolve(SCRIPT_RESULT)),
      generateText: jest.fn(() => Promise.resolve(SCRIPT_CONTENT_OK)),
    };
    // 对齐 P 违禁词库种子（BANNED_WORDS），使 checkCompliance 命中断言可验证
    const BANNED: Array<{ word: string; level: ComplianceLevel }> = [
      { word: '国家级', level: 'high' },
      { word: '最高级', level: 'high' },
      { word: '最佳', level: 'high' },
      { word: '第一品牌', level: 'high' },
      { word: '绝对', level: 'high' },
      { word: '100%', level: 'high' },
      { word: '一夜暴富', level: 'high' },
      { word: '博彩', level: 'high' },
      { word: '最', level: 'medium' },
      { word: '顶级', level: 'medium' },
      { word: '极品', level: 'medium' },
      { word: '全网最低', level: 'medium' },
      { word: '免费送', level: 'low' },
    ];
    mockCompliance = {
      checkText: jest.fn((text: string) =>
        Promise.resolve(
          (() => {
            const hits: ComplianceHit[] = [];
            const t = text ?? '';
            for (const b of BANNED) {
              const idx = t.indexOf(b.word);
              if (idx >= 0) hits.push({ word: b.word, position: idx, level: b.level });
            }
            const level = hits.reduce<ComplianceLevel>(
              (acc, h) =>
                acc === 'high' || h.level === 'high'
                  ? 'high'
                  : acc === 'medium' || h.level === 'medium'
                    ? 'medium'
                    : acc === 'low' || h.level === 'low'
                      ? 'low'
                      : 'none',
              'none',
            );
            const score =
              level === 'high' ? 100 : level === 'medium' ? 60 : level === 'low' ? 20 : 0;
            const result = level === 'high' ? 'block' : level === 'medium' ? 'warn' : 'pass';
            return {
              hits,
              level,
              score,
              result,
              checkedAt: new Date().toISOString(),
            } as ComplianceRisk;
          })(),
        ),
      ),
    };

    svc = new ScriptService(
      mockScriptRepo as unknown as Repository<ScriptEntity>,
      mockTopicRepo as unknown as Repository<TopicEntity>,
      mockSkillGateway as unknown as SkillGateway,
      mockCompliance as unknown as ComplianceService,
    );
  });

  // —— 验收点 1：generateScript 正常（消费 E 选题）——
  describe('验收点1 generateScript 正常', () => {
    it('topicRepo.findOne 返回选题 → create+save 1 次，attributionId/title/hookEmotion/status/complianceRisk/modelUsed/hook 正确', async () => {
      const topic = makeTopic({
        id: 1,
        tenantId: TENANT,
        attributionId: 'attr_t1_content_abc',
        title: '选题A',
        emotion: '好奇',
        humanDriver: '贪',
        formulaTags: ['价格'],
      });
      mockTopicRepo.findOne.mockResolvedValueOnce(topic);

      const dto: GenerateScriptDto = { topicId: 1 };
      const result = await TenantContext.run({ traceId: 't1', tenantId: TENANT }, () =>
        svc.generateScript(dto),
      );

      expect(mockScriptRepo.create).toHaveBeenCalledTimes(1);
      expect(mockScriptRepo.save).toHaveBeenCalledTimes(1);

      const script = result.script;
      expect(script.attributionId).toBe('attr_t1_content_abc');
      expect(script.title).toBe('选题A');
      expect(script.hookEmotion).toBe('好奇');
      expect(script.status).toBe('draft');
      expect(script.complianceRisk).toBeDefined();
      expect(['none', 'low', 'medium', 'high']).toContain(script.complianceRisk!.level);
      expect(script.modelUsed).toBe('ollama/llama3');
      expect(script.hook).toBe('前3秒钩子');
      // create 入参透传校验
      const created = mockScriptRepo.create.mock.calls[0][0] as ScriptEntity;
      expect(created.attributionId).toBe('attr_t1_content_abc');
      expect(created.topicId).toBe(1);
      expect(created.tenantId).toBe(TENANT);
    });
  });

  // —— 验收点 2：generateScript 选题不存在 ——
  describe('验收点2 generateScript 选题不存在', () => {
    it('topicRepo.findOne 返回 undefined → 抛 TOPIC_NOT_FOUND，skillGateway.invoke 未被调用', async () => {
      mockTopicRepo.findOne.mockResolvedValueOnce(null);

      const dto: GenerateScriptDto = { topicId: 999 };
      await expect(
        TenantContext.run({ traceId: 't2', tenantId: TENANT }, () => svc.generateScript(dto)),
      ).rejects.toMatchObject({ code: 'TOPIC_NOT_FOUND' });

      expect(mockSkillGateway.invoke).not.toHaveBeenCalled();
      expect(mockScriptRepo.save).not.toHaveBeenCalled();
    });
  });

  // —— 验收点 3：generateScript 钩子情绪非法 ——
  // Bug 1 已修复（舟行）：script.service.ts 的 generateScript 将 EMOTION_INVALID 校验
  // 提前到 SkillGateway.invoke 调用之前（早期 return）。
  // 因此非法 emotion 时 invoke / save 均不会被调用，此处验证三点。
  describe('验收点3 generateScript 钩子情绪非法', () => {
    it("topic.emotion='非法情绪' → 抛 EMOTION_INVALID，且 save 与 invoke 均未被调用", async () => {
      const topic = makeTopic({ id: 1, emotion: '非法情绪' });
      mockTopicRepo.findOne.mockResolvedValueOnce(topic);

      const dto: GenerateScriptDto = { topicId: 1 };
      await expect(
        TenantContext.run({ traceId: 't3', tenantId: TENANT }, () => svc.generateScript(dto)),
      ).rejects.toMatchObject({ code: 'EMOTION_INVALID' });

      expect(mockScriptRepo.save).not.toHaveBeenCalled();
      expect(mockSkillGateway.invoke).not.toHaveBeenCalled();
    });
  });

  // —— 验收点 4：listScripts 过滤+分页+排序 ——
  describe('验收点4 listScripts 过滤+分页+排序', () => {
    it('where 带 tenant_id；topicId/status 触发 andWhere；orderBy created_at DESC；返回 buildPage 结构', async () => {
      const rows = [makeScript({ id: 1 }), makeScript({ id: 2 })];
      qb.getManyAndCount.mockResolvedValueOnce([rows, 2]);

      const query: ScriptQueryDto = {
        page: 1,
        pageSize: 20,
        topicId: 5,
        status: 'draft',
      };
      const result = await TenantContext.run({ traceId: 't4', tenantId: TENANT }, () =>
        svc.listScripts(query),
      );

      expect(qb.where).toHaveBeenCalledWith('s.tenant_id = :tenantId', { tenantId: TENANT });
      expect(qb.andWhere).toHaveBeenCalledWith('s.topic_id = :topicId', { topicId: 5 });
      expect(qb.andWhere).toHaveBeenCalledWith('s.status = :status', { status: 'draft' });
      expect(qb.orderBy).toHaveBeenCalledWith('s.created_at', 'DESC');
      expect(result).toEqual({ list: rows, total: 2, page: 1, pageSize: 20 });
    });
  });

  // —— 验收点 5：getScript 不存在/存在 ——
  describe('验收点5 getScript', () => {
    it('不存在 → 抛 SCRIPT_NOT_FOUND', async () => {
      mockScriptRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        TenantContext.run({ traceId: 't5a', tenantId: TENANT }, () => svc.getScript(999)),
      ).rejects.toMatchObject({ code: 'SCRIPT_NOT_FOUND' });
    });

    it('存在 → 返回实体', async () => {
      const script = makeScript({ id: 7 });
      mockScriptRepo.findOne.mockResolvedValueOnce(script);
      const result = await TenantContext.run({ traceId: 't5b', tenantId: TENANT }, () =>
        svc.getScript(7),
      );
      expect(result.id).toBe(7);
      expect(mockScriptRepo.findOne.mock.calls[0][0]).toEqual({
        where: { id: 7, tenantId: TENANT },
      });
    });
  });

  // —— 验收点 6：updateScript 状态机合法 ——
  describe('验收点6 updateScript 状态机合法', () => {
    it("status=draft + dto={status:'reviewing'} → save 被调用、status=reviewing", async () => {
      const script = makeScript({ id: 1, status: ScriptStatus.Draft });
      mockScriptRepo.findOne.mockResolvedValueOnce(script);

      const dto: UpdateScriptDto = { status: 'reviewing' };
      const result = await TenantContext.run({ traceId: 't6', tenantId: TENANT }, () =>
        svc.updateScript(1, dto),
      );

      expect(mockScriptRepo.save).toHaveBeenCalled();
      expect(result.status).toBe('reviewing');
    });
  });

  // —— 验收点 7：updateScript 非法状态流转（原地）——
  describe('验收点7 updateScript 非法状态流转（原地）', () => {
    it("status=draft + dto={status:'draft'} → 抛 SCRIPT_INVALID_TRANSITION，未 save", async () => {
      const script = makeScript({ id: 1, status: ScriptStatus.Draft });
      mockScriptRepo.findOne.mockResolvedValueOnce(script);

      const dto: UpdateScriptDto = { status: 'draft' };
      await expect(
        TenantContext.run({ traceId: 't7', tenantId: TENANT }, () => svc.updateScript(1, dto)),
      ).rejects.toMatchObject({ code: 'SCRIPT_INVALID_TRANSITION' });

      expect(mockScriptRepo.save).not.toHaveBeenCalled();
    });
  });

  // —— 验收点 8：updateScript 非法状态流转（越级）——
  describe('验收点8 updateScript 非法状态流转（越级）', () => {
    it("status=draft + dto={status:'published'}（跳过 reviewing/approved）→ 抛 SCRIPT_INVALID_TRANSITION", async () => {
      const script = makeScript({ id: 1, status: ScriptStatus.Draft });
      mockScriptRepo.findOne.mockResolvedValueOnce(script);

      const dto: UpdateScriptDto = { status: 'published' };
      await expect(
        TenantContext.run({ traceId: 't8', tenantId: TENANT }, () => svc.updateScript(1, dto)),
      ).rejects.toMatchObject({ code: 'SCRIPT_INVALID_TRANSITION' });

      expect(mockScriptRepo.save).not.toHaveBeenCalled();
    });
  });

  // —— 验收点 9：updateScript 未知状态 ——
  describe('验收点9 updateScript 未知状态', () => {
    it("status=draft + dto={status:'xxx'} → 抛 SCRIPT_INVALID_TRANSITION", async () => {
      const script = makeScript({ id: 1, status: ScriptStatus.Draft });
      mockScriptRepo.findOne.mockResolvedValueOnce(script);

      const dto: UpdateScriptDto = { status: 'xxx' };
      await expect(
        TenantContext.run({ traceId: 't9', tenantId: TENANT }, () => svc.updateScript(1, dto)),
      ).rejects.toMatchObject({ code: 'SCRIPT_INVALID_TRANSITION' });

      expect(mockScriptRepo.save).not.toHaveBeenCalled();
    });
  });

  // —— 验收点 10：updateScript hookEmotion 非法（先于状态机校验）——
  describe('验收点10 updateScript hookEmotion 非法', () => {
    it("dto={hookEmotion:'非法情绪'} → 抛 EMOTION_INVALID（先于状态机）", async () => {
      const script = makeScript({ id: 1, status: ScriptStatus.Draft });
      mockScriptRepo.findOne.mockResolvedValueOnce(script);

      const dto: UpdateScriptDto = { hookEmotion: '非法情绪' };
      await expect(
        TenantContext.run({ traceId: 't10', tenantId: TENANT }, () => svc.updateScript(1, dto)),
      ).rejects.toMatchObject({ code: 'EMOTION_INVALID' });

      expect(mockScriptRepo.save).not.toHaveBeenCalled();
    });
  });

  // —— 验收点 11：updateScript 双轨编辑字段 ——
  describe('验收点11 updateScript 双轨编辑', () => {
    it('dto={content,hookEmotion,spokenTrack} → save 被调用，字段更新、hook 重算', async () => {
      const script = makeScript({ id: 1, status: ScriptStatus.Draft });
      mockScriptRepo.findOne.mockResolvedValueOnce(script);

      const spokenTrack = [{ tsStart: 0, tsEnd: 10, text: 'a' }];
      const dto: UpdateScriptDto = {
        content: '新内容',
        hookEmotion: '共鸣',
        spokenTrack,
      };
      const result = await TenantContext.run({ traceId: 't11', tenantId: TENANT }, () =>
        svc.updateScript(1, dto),
      );

      expect(mockScriptRepo.save).toHaveBeenCalled();
      expect(result.content).toBe('新内容');
      expect(result.hookEmotion).toBe('共鸣');
      expect(result.spokenTrack).toEqual(spokenTrack);
      // hook 被 extractHook 重算：'新内容' 无换行，取前 60 字（全文）
      expect(result.hook).toBe('新内容');
    });
  });

  // —— 验收点 12：发布门禁（高危拦截）——
  describe('验收点12 发布门禁（高危拦截）', () => {
    it('status=approved 且 complianceRisk.level=high → 抛 COMPLIANCE_BLOCKED，未 save', async () => {
      const script = makeScript({
        id: 1,
        status: ScriptStatus.Approved,
        complianceRisk: {
          hits: [{ word: '国家级', position: 0, level: 'high' }],
          level: 'high',
          checkedAt: '2025-01-01T00:00:00.000Z',
        },
      });
      mockScriptRepo.findOne.mockResolvedValueOnce(script);

      const dto: UpdateScriptDto = { status: 'published' };
      await expect(
        TenantContext.run({ traceId: 't12', tenantId: TENANT }, () => svc.updateScript(1, dto)),
      ).rejects.toMatchObject({ code: 'COMPLIANCE_BLOCKED' });

      expect(mockScriptRepo.save).not.toHaveBeenCalled();
    });
  });

  // —— 验收点 13：发布门禁（无高危可发）——
  describe('验收点13 发布门禁（无高危可发）', () => {
    it('status=approved 且 complianceRisk.level=none → save 被调用、status=published', async () => {
      const script = makeScript({
        id: 1,
        status: ScriptStatus.Approved,
        complianceRisk: { hits: [], level: 'none', checkedAt: '2025-01-01T00:00:00.000Z' },
      });
      mockScriptRepo.findOne.mockResolvedValueOnce(script);

      const dto: UpdateScriptDto = { status: 'published' };
      const result = await TenantContext.run({ traceId: 't13', tenantId: TENANT }, () =>
        svc.updateScript(1, dto),
      );

      expect(mockScriptRepo.save).toHaveBeenCalled();
      expect(result.status).toBe('published');
    });
  });

  // —— 验收点 14：checkCompliance 对当前 content 预检回写 ——
  describe('验收点14 checkCompliance 对当前 content 预检', () => {
    it("脚本 content 含 '绝对'(high) + dto={} → skillGateway 未调用、save 被调用、level=high 且 hits 含 '绝对'", async () => {
      const script = makeScript({ id: 1, content: '这是绝对的好产品' });
      mockScriptRepo.findOne.mockResolvedValueOnce(script);

      const dto: ComplianceCheckDto = {};
      const result = await TenantContext.run({ traceId: 't14', tenantId: TENANT }, () =>
        svc.checkCompliance(1, dto),
      );

      expect(mockSkillGateway.invoke).not.toHaveBeenCalled();
      expect(mockScriptRepo.save).toHaveBeenCalled();
      expect(result.complianceRisk.level).toBe('high');
      expect(result.complianceRisk.hits.some((h) => h.word === '绝对')).toBe(true);
      // 脚本 complianceRisk 被回写
      expect((mockScriptRepo.save.mock.calls[0][0] as ScriptEntity).complianceRisk?.level).toBe(
        'high',
      );
    });
  });

  // —— 验收点 15：checkCompliance 对传入 content 预检 ——
  describe('验收点15 checkCompliance 对传入 content 预检', () => {
    it("dto={content:'使用最产品'}（'最' 为 medium）→ save 被调用、level=medium、hits 含 '最'，脚本被更新", async () => {
      const script = makeScript({ id: 1, content: '原内容无违禁词' });
      mockScriptRepo.findOne.mockResolvedValueOnce(script);

      const dto: ComplianceCheckDto = { content: '使用最产品' };
      const result = await TenantContext.run({ traceId: 't15', tenantId: TENANT }, () =>
        svc.checkCompliance(1, dto),
      );

      expect(mockScriptRepo.save).toHaveBeenCalled();
      expect(result.complianceRisk.level).toBe('medium');
      expect(result.complianceRisk.hits.some((h) => h.word === '最')).toBe(true);
      expect((mockScriptRepo.save.mock.calls[0][0] as ScriptEntity).complianceRisk?.level).toBe(
        'medium',
      );
    });
  });

  // —— 验收点 16：checkCompliance 脚本不存在 ——
  describe('验收点16 checkCompliance 脚本不存在', () => {
    it('scriptRepo.findOne 返回 undefined → 抛 SCRIPT_NOT_FOUND', async () => {
      mockScriptRepo.findOne.mockResolvedValueOnce(null);

      const dto: ComplianceCheckDto = {};
      await expect(
        TenantContext.run({ traceId: 't16', tenantId: TENANT }, () =>
          svc.checkCompliance(999, dto),
        ),
      ).rejects.toMatchObject({ code: 'SCRIPT_NOT_FOUND' });

      expect(mockSkillGateway.invoke).not.toHaveBeenCalled();
    });
  });

  // —— 验收点 17：versionScript save 新版本 ——
  describe('验收点17 versionScript save 新版本', () => {
    it('status=draft,version=1,id=10 + dto={action:save,content,title} → create+save 1 次；version=2,parentVersionId=10,status=draft,继承 attributionId/topicId', async () => {
      const current = makeScript({
        id: 10,
        topicId: 3,
        attributionId: 'attr_t1_content_xyz',
        version: 1,
        status: ScriptStatus.Draft,
        title: '旧标题',
      });
      mockScriptRepo.findOne.mockResolvedValueOnce(current);

      const dto: VersionScriptDto = { action: 'save', content: 'v2内容', title: '新标题' };
      const result = await TenantContext.run({ traceId: 't17', tenantId: TENANT }, () =>
        svc.versionScript(10, dto),
      );

      expect(mockScriptRepo.create).toHaveBeenCalledTimes(1);
      expect(mockScriptRepo.save).toHaveBeenCalledTimes(1);

      const ns = result.script;
      expect(ns.version).toBe(2);
      expect(ns.parentVersionId).toBe(10);
      expect(ns.status).toBe('draft');
      expect(ns.content).toBe('v2内容');
      expect(ns.title).toBe('新标题');
      expect(ns.attributionId).toBe('attr_t1_content_xyz');
      expect(ns.topicId).toBe(3);

      const created = mockScriptRepo.create.mock.calls[0][0] as ScriptEntity;
      expect(created.version).toBe(2);
      expect(created.parentVersionId).toBe(10);
      expect(created.status).toBe('draft');
    });
  });

  // —— 验收点 18：versionScript rollback 正常 ——
  describe('验收点18 versionScript rollback 正常', () => {
    it('current(id=10) + sourceVersionId=7 → save 被调用、current.content=历史内容、parentVersionId=7', async () => {
      const current = makeScript({
        id: 10,
        topicId: 3,
        content: '当前内容',
        status: ScriptStatus.Draft,
      });
      const source = makeScript({ id: 7, topicId: 3, tenantId: TENANT, content: '历史内容' });
      mockScriptRepo.findOne
        .mockResolvedValueOnce(current) // first findOne: current
        .mockResolvedValueOnce(source); // second findOne: source

      const dto: VersionScriptDto = { action: 'rollback', sourceVersionId: 7 };
      const result = await TenantContext.run({ traceId: 't18', tenantId: TENANT }, () =>
        svc.versionScript(10, dto),
      );

      expect(mockScriptRepo.save).toHaveBeenCalled();
      expect(result.script.content).toBe('历史内容');
      expect(result.script.parentVersionId).toBe(7);
    });
  });

  // —— 验收点 19：versionScript rollback 未指定 sourceVersionId ——
  describe('验收点19 versionScript rollback 未指定 sourceVersionId', () => {
    it("dto={action:'rollback'} → 抛 SCRIPT_VERSION_REQUIRED", async () => {
      const current = makeScript({ id: 10, status: ScriptStatus.Draft });
      mockScriptRepo.findOne.mockResolvedValueOnce(current);

      const dto: VersionScriptDto = { action: 'rollback' };
      await expect(
        TenantContext.run({ traceId: 't19', tenantId: TENANT }, () => svc.versionScript(10, dto)),
      ).rejects.toMatchObject({ code: 'SCRIPT_VERSION_REQUIRED' });

      expect(mockScriptRepo.save).not.toHaveBeenCalled();
    });
  });

  // —— 验收点 20：versionScript rollback 源版本不存在 ——
  describe('验收点20 versionScript rollback 源版本不存在', () => {
    it('id=10 存在、sourceVersionId=999 返回 undefined → 抛 SCRIPT_VERSION_NOT_FOUND', async () => {
      const current = makeScript({ id: 10, status: ScriptStatus.Draft });
      mockScriptRepo.findOne
        .mockResolvedValueOnce(current) // current
        .mockResolvedValueOnce(null); // source

      const dto: VersionScriptDto = { action: 'rollback', sourceVersionId: 999 };
      await expect(
        TenantContext.run({ traceId: 't20', tenantId: TENANT }, () => svc.versionScript(10, dto)),
      ).rejects.toMatchObject({ code: 'SCRIPT_VERSION_NOT_FOUND' });

      expect(mockScriptRepo.save).not.toHaveBeenCalled();
    });
  });

  // —— 验收点 21：versionScript 脚本不存在 ——
  describe('验收点21 versionScript 脚本不存在', () => {
    it('scriptRepo.findOne 返回 undefined → 抛 SCRIPT_NOT_FOUND', async () => {
      mockScriptRepo.findOne.mockResolvedValueOnce(null);

      const dto: VersionScriptDto = { action: 'save', content: 'x' };
      await expect(
        TenantContext.run({ traceId: 't21', tenantId: TENANT }, () => svc.versionScript(999, dto)),
      ).rejects.toMatchObject({ code: 'SCRIPT_NOT_FOUND' });

      expect(mockScriptRepo.create).not.toHaveBeenCalled();
    });
  });

  // —— 验收点 22：listTemplates ——
  describe('验收点22 listTemplates', () => {
    it('返回 { templates }，长度为 4（痛/悬/对/情）', () => {
      const result = svc.listTemplates();
      expect(result.templates).toBe(SCRIPT_TEMPLATES);
      expect(result.templates.length).toBe(4);
      expect(result.templates.map((t) => t.id)).toEqual([
        'pain-hook',
        'suspense',
        'compare',
        'emotion',
      ]);
    });
  });

  // —— 验收点 23：跨租户隔离 ——
  describe('验收点23 跨租户隔离', () => {
    it('不同 tenantId 下，repo 收到的 tenantId 参数正确', async () => {
      // (1) generateScript：topicRepo.findOne 的 where.tenantId 正确
      const genTenant = 'tn-gen';
      const topic = makeTopic({ id: 1, tenantId: genTenant });
      mockTopicRepo.findOne.mockResolvedValueOnce(topic);
      mockSkillGateway.invoke.mockResolvedValueOnce(SCRIPT_RESULT);
      await TenantContext.run({ traceId: 't23a', tenantId: genTenant }, () =>
        svc.generateScript({ topicId: 1 }),
      );
      const genCall = mockTopicRepo.findOne.mock.calls.find((c) => {
        const w = (c[0] as FindOneCall | undefined)?.where;
        return w?.id === 1;
      });
      expect((genCall?.[0] as FindOneCall | undefined)?.where?.tenantId).toBe(genTenant);

      // (2) listScripts：scriptRepo.createQueryBuilder.where 带对应 tenant_id
      const listTenant = 'tn-list';
      const whereCalls: Array<{ sql: string; param: unknown }> = [];
      qb.where.mockImplementation((sql: string, param: unknown) => {
        whereCalls.push({ sql, param });
        return qb;
      });
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      await TenantContext.run({ traceId: 't23b', tenantId: listTenant }, () =>
        svc.listScripts({ page: 1, pageSize: 20 }),
      );
      const listWhere = whereCalls.find((w) => w.sql.startsWith('s.tenant_id'));
      expect(listWhere?.param).toEqual({ tenantId: listTenant });

      // (3) getScript：scriptRepo.findOne 的 where.tenantId 正确
      const getTenant = 'tn-get';
      mockScriptRepo.findOne.mockResolvedValueOnce(makeScript({ id: 5, tenantId: getTenant }));
      await TenantContext.run({ traceId: 't23c', tenantId: getTenant }, () => svc.getScript(5));
      const getCall = mockScriptRepo.findOne.mock.calls.find((c) => {
        const w = (c[0] as FindOneCall | undefined)?.where;
        return w?.id === 5;
      });
      expect((getCall?.[0] as FindOneCall | undefined)?.where?.tenantId).toBe(getTenant);
    });
  });

  // —— 附加：无 TenantContext 防护 ——
  describe('租户上下文缺失防护', () => {
    it('未包裹 TenantContext.run 调用 getScript → 抛 TENANT_REQUIRED', async () => {
      await expect(svc.getScript(1)).rejects.toMatchObject({ code: 'TENANT_REQUIRED' });
    });
  });
});
