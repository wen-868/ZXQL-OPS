import { DeepPartial, Repository } from 'typeorm';
import { Observable } from 'rxjs';
/** 测试用：类型化的假 QueryBuilder（链式调用返回自身；各方法为 jest.Mock 以便断言） */
interface MockQueryBuilder {
  where: jest.Mock<MockQueryBuilder, [string, Record<string, unknown>]>;
  andWhere: jest.Mock<MockQueryBuilder, [string, Record<string, unknown>]>;
  orderBy: jest.Mock<MockQueryBuilder, [string, string]>;
  skip: jest.Mock<MockQueryBuilder, [number]>;
  take: jest.Mock<MockQueryBuilder, [number]>;
  getManyAndCount: jest.Mock<Promise<[WorkflowDefEntity[], number]>, []>;
}

import { WorkflowService } from './workflow.service';
import { WorkflowDefEntity, WorkflowRunEntity, WorkflowRunLogEntity } from './workflow.entity';
import { WorkflowNode, WorkflowEdge } from './workflow.types';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { IntelService } from '../intel/intel.service';
import { AnalyzeService } from '../analyze/analyze.service';
import { TopicService } from '../topic/topic.service';
import { ScriptService } from '../script/script.service';
import { MaterialService } from '../g/g.service';
import { VideoService } from '../h/h.service';
import { PublishService } from '../publish/publish.service';
import { TenantContext } from '../../tenant/tenant-context';
import { PaginationQueryDto } from '../../shared/pagination';

/**
 * WorkflowService（L 工作流编排）单元测试（规划 §4-L / R7 任务卡）。
 * 直接实例化 `new WorkflowService(mockDefRepo, mockRunRepo, mockLogRepo, mockIntel, mockAnalyze, mockTopic, mockScript, mockPublish)`（不走 Nest DI）。
 * 所有业务调用用 `TenantContext.run({ traceId, tenantId }, () => svc.xxx())` 包裹，
 * 否则 service 内的 requireTenantId 会抛 TENANT_REQUIRED。
 */

const TENANT = 'tn-1';
const TENANT_OTHER = 'tn-other';

// —— 测试辅助：编排定义实体 ——
function makeDef(partial: Partial<WorkflowDefEntity> = {}): WorkflowDefEntity {
  return {
    id: partial.id ?? 1,
    tenantId: partial.tenantId ?? TENANT,
    name: partial.name ?? '编排A',
    nodes: partial.nodes ?? [],
    edges: partial.edges ?? [],
    trigger: partial.trigger ?? 'manual',
    cronExpr: partial.cronExpr ?? null,
    enabled: partial.enabled ?? true,
    createdAt: partial.createdAt ?? new Date('2025-01-01T00:00:00Z'),
    updatedAt: partial.updatedAt ?? new Date('2025-01-01T00:00:00Z'),
  } as WorkflowDefEntity;
}

// —— 测试辅助：线性编排（C→D→E→F→I）——
function linearDef(
  opts: {
    topicId?: number;
    scriptId?: number;
    accountIds?: number[];
    platform?: string;
    ideateDriver?: string;
    skipIdeate?: boolean;
  } = {},
): WorkflowDefEntity {
  const nodes: WorkflowNode[] = [
    { id: 'a', type: 'collect' },
    { id: 'b', type: 'analyze' },
  ];
  const edges: WorkflowEdge[] = [
    { from: 'a', to: 'b' },
    { from: 'b', to: 'c' },
  ];
  if (opts.skipIdeate) {
    // collect → analyze → script 直接连边（无 ideate）
    nodes.push({
      id: 'c',
      type: 'script',
      config: opts.scriptId ? { topicId: opts.scriptId } : {},
    });
    edges.push({ from: 'c', to: 'd' });
    nodes.push({
      id: 'd',
      type: 'publish',
      config: {
        accountIds: opts.accountIds ?? [1],
        platform: opts.platform ?? 'douyin',
        ...(opts.scriptId ? { scriptId: opts.scriptId } : {}),
      },
    });
  } else {
    nodes.push({ id: 'c', type: 'ideate', config: { driver: opts.ideateDriver ?? '贪' } });
    nodes.push({ id: 'd', type: 'script' });
    nodes.push({
      id: 'e',
      type: 'publish',
      config: { accountIds: opts.accountIds ?? [1], platform: opts.platform ?? 'douyin' },
    });
    edges.push({ from: 'c', to: 'd' }, { from: 'd', to: 'e' });
  }
  return makeDef({ id: 1, nodes, edges });
}

describe('WorkflowService', () => {
  let svc: WorkflowService;
  let mockDefRepo: jest.Mocked<Repository<WorkflowDefEntity>>;
  let mockRunRepo: jest.Mocked<Repository<WorkflowRunEntity>>;
  let mockLogRepo: jest.Mocked<Repository<WorkflowRunLogEntity>>;
  let mockIntel: jest.Mocked<IntelService>;
  let mockAnalyze: jest.Mocked<AnalyzeService>;
  let mockTopic: jest.Mocked<TopicService>;
  let mockScript: jest.Mocked<ScriptService>;
  let mockPublish: jest.Mocked<PublishService>;

  beforeEach(() => {
    mockDefRepo = {
      create: jest.fn(
        (e: DeepPartial<WorkflowDefEntity>) => ({ id: 0, ...e }) as WorkflowDefEntity,
      ),
      save: jest.fn(async (e: WorkflowDefEntity) => e),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<WorkflowDefEntity>>;
    mockRunRepo = {
      create: jest.fn(
        (e: DeepPartial<WorkflowRunEntity>) => ({ id: 0, ...e }) as WorkflowRunEntity,
      ),
      save: jest.fn(async (e: WorkflowRunEntity) => e),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<WorkflowRunEntity>>;
    mockLogRepo = {
      create: jest.fn(
        (e: DeepPartial<WorkflowRunLogEntity>) => ({ id: 0, ...e }) as WorkflowRunLogEntity,
      ),
      save: jest.fn(async (e: WorkflowRunLogEntity) => e),
      findOne: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<WorkflowRunLogEntity>>;
    mockIntel = {
      processPendingTasks: jest.fn(async () => undefined),
    } as unknown as jest.Mocked<IntelService>;
    mockAnalyze = {
      processPendingAnalysis: jest.fn(async () => 3),
    } as unknown as jest.Mocked<AnalyzeService>;
    mockTopic = {
      generateTopics: jest.fn(async () => ({ topics: [{ id: 10 }] })),
    } as unknown as jest.Mocked<TopicService>;
    mockScript = {
      generateScript: jest.fn(async () => ({ script: { id: 20 } })),
    } as unknown as jest.Mocked<ScriptService>;
    const mockMaterial = {
      generateMaterial: jest.fn(async () => ({ id: 30, type: 'video' })),
    } as unknown as jest.Mocked<MaterialService>;
    const mockVideo = {
      fromScript: jest.fn(async () => ({ id: 40, status: 'done' })),
    } as unknown as jest.Mocked<VideoService>;
    mockPublish = {
      publish: jest.fn(async () => ({ taskIds: [50] })),
    } as unknown as jest.Mocked<PublishService>;

    svc = new WorkflowService(
      mockDefRepo,
      mockRunRepo,
      mockLogRepo,
      mockIntel,
      mockAnalyze,
      mockTopic,
      mockScript,
      mockMaterial,
      mockVideo,
      mockPublish,
    );
  });

  // ============ 验收点 1：createDef 正常 ============
  describe('验收点1 createDef 正常', () => {
    it('defRepo.create+save 各 1 次；保存 nodes/edges/trigger 正确；返回含 id 的实体', async () => {
      const dto: CreateWorkflowDto = {
        name: '编排A',
        nodes: [
          { id: 'a', type: 'collect' },
          { id: 'b', type: 'analyze' },
        ],
        edges: [{ from: 'a', to: 'b' }],
        trigger: 'manual',
        enabled: true,
      };
      const result = await TenantContext.run({ traceId: 't1', tenantId: TENANT }, () =>
        svc.createDef(dto),
      );

      expect(mockDefRepo.create).toHaveBeenCalledTimes(1);
      expect(mockDefRepo.save).toHaveBeenCalledTimes(1);

      const created = mockDefRepo.create.mock.calls[0][0] as Partial<WorkflowDefEntity>;
      expect(created.tenantId).toBe(TENANT);
      expect(created.name).toBe('编排A');
      expect(created.nodes).toEqual(dto.nodes);
      expect(created.edges).toEqual(dto.edges);
      expect(created.trigger).toBe('manual');
      expect(created.enabled).toBe(true);

      expect(result.id).toBeDefined();
      expect(result.name).toBe('编排A');
    });
  });

  // ============ 验收点 2：节点 id 重复 ============
  describe('验收点2 createDef 节点 id 重复', () => {
    it("nodes=[{id:'a'},{id:'a'}] → 抛 WORKFLOW_NODE_DUP；defRepo.save 未被调用", async () => {
      const dto: CreateWorkflowDto = {
        name: 'dup',
        nodes: [
          { id: 'a', type: 'collect' },
          { id: 'a', type: 'analyze' },
        ],
        trigger: 'manual',
      };
      await expect(
        TenantContext.run({ traceId: 't2', tenantId: TENANT }, () => svc.createDef(dto)),
      ).rejects.toMatchObject({ code: 'WORKFLOW_NODE_DUP' });

      expect(mockDefRepo.save).not.toHaveBeenCalled();
    });
  });

  // ============ 验收点 3：边引用不存在节点 ============
  describe('验收点3 createDef 边引用不存在节点', () => {
    it("edges=[{from:'a',to:'x'}] → 抛 WORKFLOW_EDGE_INVALID", async () => {
      const dto: CreateWorkflowDto = {
        name: 'badEdge',
        nodes: [{ id: 'a', type: 'collect' }],
        edges: [{ from: 'a', to: 'x' }],
        trigger: 'manual',
      };
      await expect(
        TenantContext.run({ traceId: 't3', tenantId: TENANT }, () => svc.createDef(dto)),
      ).rejects.toMatchObject({ code: 'WORKFLOW_EDGE_INVALID' });

      expect(mockDefRepo.save).not.toHaveBeenCalled();
    });
  });

  // ============ 验收点 4：存在环 ============
  describe('验收点4 createDef 存在环', () => {
    it('edges=[{a,b},{b,a}] → 抛 WORKFLOW_DAG_CYCLE', async () => {
      const dto: CreateWorkflowDto = {
        name: 'cycle',
        nodes: [
          { id: 'a', type: 'collect' },
          { id: 'b', type: 'analyze' },
        ],
        edges: [
          { from: 'a', to: 'b' },
          { from: 'b', to: 'a' },
        ],
        trigger: 'manual',
      };
      await expect(
        TenantContext.run({ traceId: 't4', tenantId: TENANT }, () => svc.createDef(dto)),
      ).rejects.toMatchObject({ code: 'WORKFLOW_DAG_CYCLE' });

      expect(mockDefRepo.save).not.toHaveBeenCalled();
    });
  });

  // ============ 验收点 5：cron 缺 cronExpr ============
  describe('验收点5 createDef trigger=cron 缺 cronExpr', () => {
    it("trigger='cron' 且无 cronExpr → 抛 WORKFLOW_CRON_REQUIRED", async () => {
      const dto: CreateWorkflowDto = {
        name: 'cronDef',
        nodes: [{ id: 'a', type: 'collect' }],
        trigger: 'cron',
      };
      await expect(
        TenantContext.run({ traceId: 't5', tenantId: TENANT }, () => svc.createDef(dto)),
      ).rejects.toMatchObject({ code: 'WORKFLOW_CRON_REQUIRED' });

      expect(mockDefRepo.save).not.toHaveBeenCalled();
    });
  });

  // ============ 验收点 6：listDefs ============
  describe('验收点6 listDefs', () => {
    it('createQueryBuilder.where 带 tenant_id；orderBy(w.created_at,DESC)；getManyAndCount→buildPage 结构', async () => {
      const rows = [makeDef({ id: 1 }), makeDef({ id: 2 })];
      const qb = {
        where: jest.fn(() => qb),
        andWhere: jest.fn(() => qb),
        orderBy: jest.fn(() => qb),
        skip: jest.fn(() => qb),
        take: jest.fn(() => qb),
        getManyAndCount: jest.fn(async () => [rows, 2]),
      } as unknown as MockQueryBuilder;
      mockDefRepo.createQueryBuilder.mockReturnValue(qb as never);

      const query: PaginationQueryDto = { page: 1, pageSize: 20 };
      const result = await TenantContext.run({ traceId: 't6', tenantId: TENANT }, () =>
        svc.listDefs(query),
      );

      expect(mockDefRepo.createQueryBuilder).toHaveBeenCalledWith('w');
      // where 第一调用应带 tenant_id 条件
      const whereCall = qb.where.mock.calls[0];
      expect(whereCall[0]).toContain('tenant_id');
      expect(whereCall[1]).toEqual({ tenantId: TENANT });
      expect(qb.orderBy).toHaveBeenCalledWith('w.created_at', 'DESC');
      expect(result).toEqual({ list: rows, total: 2, page: 1, pageSize: 20 });
    });
  });

  // ============ 验收点 7：getDef 不存在/存在 ============
  describe('验收点7 getDef', () => {
    it('不存在 → 抛 WORKFLOW_NOT_FOUND', async () => {
      mockDefRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        TenantContext.run({ traceId: 't7a', tenantId: TENANT }, () => svc.getDef(999)),
      ).rejects.toMatchObject({ code: 'WORKFLOW_NOT_FOUND' });
    });

    it('存在 → 返回实体且 where 带 tenantId', async () => {
      const def = makeDef({ id: 7 });
      mockDefRepo.findOne.mockResolvedValueOnce(def);
      const result = await TenantContext.run({ traceId: 't7b', tenantId: TENANT }, () =>
        svc.getDef(7),
      );
      expect(result.id).toBe(7);
      expect(mockDefRepo.findOne.mock.calls[0][0]).toEqual({ where: { id: 7, tenantId: TENANT } });
    });
  });

  // ============ 验收点 8：updateDef 不存在/存在 ============
  describe('验收点8 updateDef', () => {
    it('不存在 → 抛 WORKFLOW_NOT_FOUND', async () => {
      mockDefRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        TenantContext.run({ traceId: 't8a', tenantId: TENANT }, () => svc.updateDef(999, {})),
      ).rejects.toMatchObject({ code: 'WORKFLOW_NOT_FOUND' });
      expect(mockDefRepo.save).not.toHaveBeenCalled();
    });

    it('存在且 dto={enabled:false} → save 调用、def.enabled===false', async () => {
      const def = makeDef({ id: 7, enabled: true });
      mockDefRepo.findOne.mockResolvedValueOnce(def);
      await TenantContext.run({ traceId: 't8b', tenantId: TENANT }, () =>
        svc.updateDef(7, { enabled: false }),
      );
      expect(mockDefRepo.save).toHaveBeenCalledTimes(1);
      expect(mockDefRepo.save.mock.calls[0][0].enabled).toBe(false);
      expect(def.enabled).toBe(false);
    });
  });

  // ============ 验收点 9：run 正常（串联 C→D→E→F→I）============
  describe('验收点9 run 正常串联', () => {
    it('5 节点全 done；run.status=success,progress=100；topicId/scriptId 透传', async () => {
      const def = linearDef({ accountIds: [1], platform: 'douyin' });
      mockDefRepo.findOne.mockResolvedValueOnce(def);

      const result = await TenantContext.run({ traceId: 't9', tenantId: TENANT }, () =>
        svc.run(def.id),
      );

      // run 创建 1 次；run save = 初始1 + 每节点progress5 + 终态1 = 7；log save = 每节点起止2次 * 5 = 10
      expect(mockRunRepo.create).toHaveBeenCalledTimes(1);
      expect(mockRunRepo.save).toHaveBeenCalledTimes(7);
      expect(mockLogRepo.create).toHaveBeenCalledTimes(5);
      expect(mockLogRepo.save).toHaveBeenCalledTimes(10);

      const savedRun = mockRunRepo.save.mock.calls[mockRunRepo.save.mock.calls.length - 1][0];
      expect(savedRun.status).toBe('success');
      expect(savedRun.progress).toBe(100);
      expect(result.runId).toBeDefined();

      // 每个节点最终 log 出现过 'done'（按 nodeType 收集 status 集合，避免取 slice 引用问题）
      const logSaves = mockLogRepo.save.mock.calls.map((c: any[]) => c[0]);
      const statusByNode: Record<string, Set<string>> = {};
      for (const l of logSaves) {
        (statusByNode[l.nodeType] ??= new Set()).add(l.status);
      }
      for (const t of ['collect', 'analyze', 'ideate', 'script', 'publish']) {
        expect(statusByNode[t].has('done')).toBe(true);
      }

      // topicId 透传
      expect(mockTopic.generateTopics).toHaveBeenCalledTimes(1);
      expect(mockScript.generateScript).toHaveBeenCalledTimes(1);
      expect(mockScript.generateScript.mock.calls[0][0]).toMatchObject({ topicId: 10 });
      // scriptId 透传 + accountIds 含 1
      expect(mockPublish.publish).toHaveBeenCalledTimes(1);
      expect(mockPublish.publish.mock.calls[0][0]).toMatchObject({ scriptId: 20, accountIds: [1] });
    });
  });

  // ============ 验收点 10：run 单节点失败隔离 ============
  describe('验收点10 run 单节点失败隔离', () => {
    it('analyze 抛错 → run.status=partial；analyze log=failed；其余节点仍执行且 done', async () => {
      const def = linearDef();
      mockDefRepo.findOne.mockResolvedValueOnce(def);
      mockAnalyze.processPendingAnalysis.mockRejectedValueOnce(new Error('analyze boom'));

      const result = await TenantContext.run({ traceId: 't10', tenantId: TENANT }, () =>
        svc.run(def.id),
      );

      const savedRun = mockRunRepo.save.mock.calls[mockRunRepo.save.mock.calls.length - 1][0];
      expect(savedRun.status).toBe('partial');
      expect(savedRun.status).not.toBe('failed');

      // 其余服务均被调用（collect/ideate/script/publish）
      expect(mockIntel.processPendingTasks).toHaveBeenCalled();
      expect(mockTopic.generateTopics).toHaveBeenCalled();
      expect(mockScript.generateScript).toHaveBeenCalled();
      expect(mockPublish.publish).toHaveBeenCalled();

      // 各节点最终 log 状态（按 nodeType 收集所有出现过的 status）
      const logSaves = mockLogRepo.save.mock.calls.map((c: any[]) => c[0]);
      const statusByNode: Record<string, Set<string>> = {};
      for (const l of logSaves) {
        (statusByNode[l.nodeType] ??= new Set()).add(l.status);
      }
      expect(statusByNode.analyze.has('failed')).toBe(true);
      expect(statusByNode.collect.has('done')).toBe(true);
      expect(statusByNode.ideate.has('done')).toBe(true);
      expect(statusByNode.script.has('done')).toBe(true);
      expect(statusByNode.publish.has('done')).toBe(true);

      const analyzeErrorLog = logSaves.find(
        (l: any) => l.nodeType === 'analyze' && l.status === 'failed',
      );
      expect(analyzeErrorLog.output.error).toBeDefined();
      expect(result.runId).toBeDefined();
    });
  });

  // ============ 验收点 11：run 缺上游产出 ============
  describe('验收点11 run 缺上游产出', () => {
    it('collect→script 无 ideate，script 无 topicId → script log=failed、run=partial', async () => {
      const def = linearDef({ skipIdeate: true });
      // 确保 ctx.__topicId 未注入；且 script config 无 topicId → executeNode 抛 WORKFLOW_MISSING_INPUT
      mockDefRepo.findOne.mockResolvedValueOnce(def);

      const result = await TenantContext.run({ traceId: 't11', tenantId: TENANT }, () =>
        svc.run(def.id),
      );

      const savedRun = mockRunRepo.save.mock.calls[mockRunRepo.save.mock.calls.length - 1][0];
      expect(savedRun.status).toBe('partial');

      const logSaves = mockLogRepo.save.mock.calls.map((c: any[]) => c[0]);
      const statusByNode: Record<string, Set<string>> = {};
      for (const l of logSaves) {
        (statusByNode[l.nodeType] ??= new Set()).add(l.status);
      }
      expect(statusByNode.script.has('failed')).toBe(true);
      // 整体未全败：已执行节点 collect/analyze 仍 done；publish 因同样缺上游 scriptId 被隔离失败
      expect(statusByNode.collect.has('done')).toBe(true);
      expect(statusByNode.analyze.has('done')).toBe(true);
      expect(statusByNode.publish.has('failed')).toBe(true);
      expect(result.runId).toBeDefined();
    });
  });

  // ============ 验收点 12：run 编排不存在 ============
  describe('验收点12 run 编排不存在', () => {
    it('defRepo.findOne 返回 undefined → 抛 WORKFLOW_NOT_FOUND', async () => {
      mockDefRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        TenantContext.run({ traceId: 't12', tenantId: TENANT }, () => svc.run(404)),
      ).rejects.toMatchObject({ code: 'WORKFLOW_NOT_FOUND' });
      expect(mockRunRepo.save).not.toHaveBeenCalled();
    });
  });

  // ============ 验收点 13：跨租户隔离 ============
  describe('验收点13 跨租户隔离', () => {
    it('不同 tenantId 下 repo 收到的 tenantId 参数正确', async () => {
      const def = linearDef({ accountIds: [1], platform: 'douyin' });
      mockDefRepo.findOne.mockResolvedValueOnce(def);

      await TenantContext.run({ traceId: 't13', tenantId: TENANT_OTHER }, () => svc.run(def.id));

      // defRepo.findOne 的 where.tenantId
      expect(mockDefRepo.findOne.mock.calls[0][0]).toEqual({
        where: { id: def.id, tenantId: TENANT_OTHER },
      });
      // runRepo.create 的 tenantId
      expect(mockRunRepo.create.mock.calls[0][0].tenantId).toBe(TENANT_OTHER);
      // logRepo.create 的 tenantId（多次，取首个）
      expect(mockLogRepo.create.mock.calls[0][0].tenantId).toBe(TENANT_OTHER);

      // 再用 TENANT 跑一次 createDef/listDefs/getDef 校验
      const dto: CreateWorkflowDto = {
        name: 'x',
        nodes: [{ id: 'a', type: 'collect' }],
        trigger: 'manual',
      };
      await TenantContext.run({ traceId: 't13b', tenantId: TENANT }, () => svc.createDef(dto));
      expect(mockDefRepo.create.mock.calls[0][0].tenantId).toBe(TENANT);

      const qb = {
        where: jest.fn(() => qb),
        andWhere: jest.fn(() => qb),
        orderBy: jest.fn(() => qb),
        skip: jest.fn(() => qb),
        take: jest.fn(() => qb),
        getManyAndCount: jest.fn(async () => [[], 0]),
      } as unknown as MockQueryBuilder;
      mockDefRepo.createQueryBuilder.mockReturnValue(qb as never);
      await TenantContext.run({ traceId: 't13c', tenantId: TENANT }, () =>
        svc.listDefs({ page: 1, pageSize: 20 }),
      );
      expect(qb.where.mock.calls[0][1]).toEqual({ tenantId: TENANT });

      mockDefRepo.findOne.mockResolvedValueOnce(makeDef({ id: 3 }));
      await TenantContext.run({ traceId: 't13d', tenantId: TENANT }, () => svc.getDef(3));
      expect(mockDefRepo.findOne.mock.calls[mockDefRepo.findOne.mock.calls.length - 1][0]).toEqual({
        where: { id: 3, tenantId: TENANT },
      });
    });
  });

  // ============ 验收点 14（可选）：streamRun 返回 Observable ============
  describe('验收点14 streamRun 返回 Observable（可选）', () => {
    it('返回 Observable 且 subscribe 能取到至少一条含 run/logs 的 data', (done) => {
      const run: Partial<WorkflowRunEntity> = { id: 5, status: 'running', progress: 0 };
      mockRunRepo.findOne.mockResolvedValue(run as WorkflowRunEntity);
      mockLogRepo.find.mockResolvedValue([]);

      const obs: Observable<{ data: { run: WorkflowRunEntity; logs: WorkflowRunLogEntity[] } }> =
        svc.streamRun(5);
      expect(typeof obs.subscribe).toBe('function');

      let got = false;
      const sub = obs.subscribe({
        next: (val: { data: { run: WorkflowRunEntity; logs: WorkflowRunLogEntity[] } }) => {
          got = true;
          clearTimeout(timer);
          try {
            expect(val).toHaveProperty('data');
            expect(val.data).toHaveProperty('run');
            expect(val.data).toHaveProperty('logs');
          } catch (e) {
            sub.unsubscribe();
            done(e);
            return;
          }
          sub.unsubscribe();
          done();
        },
        error: (e) => {
          clearTimeout(timer);
          done(e);
        },
      });
      // 兜底：避免流永不触发时测试挂起
      const timer = setTimeout(() => {
        if (!got) {
          sub.unsubscribe();
          done(new Error('streamRun 未在 1.5s 内发出任何 data'));
        }
      }, 1500);
    });
  });

  // ============ 附加：租户上下文缺失防护 ============
  describe('租户上下文缺失防护', () => {
    it('未包裹 TenantContext.run 调用 createDef → 抛 TENANT_REQUIRED', async () => {
      const dto: CreateWorkflowDto = {
        name: 'x',
        nodes: [{ id: 'a', type: 'collect' }],
        trigger: 'manual',
      };
      await expect(svc.createDef(dto)).rejects.toMatchObject({ code: 'TENANT_REQUIRED' });
    });
  });
});
