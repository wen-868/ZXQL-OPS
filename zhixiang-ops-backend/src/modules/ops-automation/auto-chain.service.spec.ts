import { AutoChainService } from './auto-chain.service';
import { OpsStrategyRegistry } from './ops-strategy.registry';
import { OpsChainContext, OpsStage, OpsStrategy, OpsStageResult } from './ops-automation.types';
import { AnalyzeService } from '../analyze/analyze.service';
import { IntelService } from '../intel/intel.service';

/**
 * AutoChainService 编排测试（规划 §4-A 全链路自动化）。
 * 用纯内存 fake 策略注册进真实 Registry，验证：
 * - 阶段筛选（stages 参数：只跑第一段 检索→筛选）
 * - 全阶段串联与 ctx 产物吸收
 * - 单阶段失败不中断链路
 * - 租户上下文透传（策略内可读 tenantId）
 */

function fakeStrategy(stage: OpsStage, key: string, result?: OpsStageResult): OpsStrategy {
  const run = jest.fn<Promise<OpsStageResult>, [OpsChainContext, Record<string, unknown>]>();
  if (result !== undefined) {
    run.mockResolvedValue(result);
  } else {
    run.mockResolvedValue({});
  }
  return {
    meta: {
      key,
      stage,
      name: `fake-${key}`,
      tech: 'test',
      impl: 'rule' as const,
      scenarios: ['test'],
      enabledByDefault: false,
      desc: 'test',
    },
    run,
  };
}

describe('AutoChainService', () => {
  let registry: OpsStrategyRegistry;
  let strategies: OpsStrategy[];
  let svc: AutoChainService;

  beforeEach(() => {
    registry = new OpsStrategyRegistry();
    strategies = [
      fakeStrategy('retrieve', 'retrieve_a', { collectTaskIds: [1] }),
      fakeStrategy('retrieve', 'retrieve_b'),
      fakeStrategy('screen', 'screen_a', { topicIds: [11, 12] }),
      fakeStrategy('screen', 'screen_b'),
      fakeStrategy('publish-up', 'publish_a'),
      fakeStrategy('deliver', 'deliver_a'),
      fakeStrategy('verify', 'verify_a', { recycleTaskIds: [99] }),
    ];
    const intelService = {
      getCollectTask: jest.fn().mockResolvedValue({ status: 'done' }),
    } as unknown as IntelService;
    const analyzeService = {
      createAnalysisTask: jest.fn().mockResolvedValue({ taskId: 1 }),
      getAnalysisTask: jest.fn().mockResolvedValue({ status: 'done' }),
    } as unknown as AnalyzeService;
    svc = new AutoChainService(registry, strategies, intelService, analyzeService);
    svc.onModuleInit();
  });

  describe('runOnce', () => {
    it('默认跑全部 5 个阶段 + 自动 D 分析，报告含每阶段策略 key 与 ok=true', async () => {
      const res = await svc.runOnce('tn-1');
      expect(Object.keys(res.stages).sort()).toEqual([
        'analyze',
        'deliver',
        'publish-up',
        'retrieve',
        'screen',
        'verify',
      ]);
      for (const [stage, r] of Object.entries(res.stages)) {
        expect(r.ok).toBe(true);
        expect(r.strategy).toMatch(/^(retrieve|screen|publish|deliver|verify|auto_analysis)/);
        void stage;
      }
      expect(res.chainRunId).toBeTruthy();
    });

    it('stages 筛选只跑指定阶段（检索+筛选）时不触碰后三个阶段', async () => {
      const res = await svc.runOnce('tn-1', undefined, ['retrieve', 'screen']);
      expect(Object.keys(res.stages).sort()).toEqual(['analyze', 'retrieve', 'screen']);
      const retrieve = strategies[0].run as jest.Mock;
      const screen = strategies[2].run as jest.Mock;
      expect(retrieve).toHaveBeenCalledTimes(1);
      expect(screen).toHaveBeenCalledTimes(1);
      // 后三阶段策略未被调用
      for (const s of strategies.slice(4)) {
        expect((s.run as jest.Mock).mock.calls.length).toBe(0);
      }
    });

    it('空 stages 数组等价于全阶段', async () => {
      const res = await svc.runOnce('tn-1', undefined, []);
      expect(Object.keys(res.stages)).toHaveLength(6);
    });

    it('阶段失败不中断：screen 抛错后 publish-up 仍执行，报告标记失败', async () => {
      const screen = strategies[2].run as jest.Mock;
      screen.mockRejectedValueOnce(new Error('screen boom'));
      const res = await svc.runOnce('tn-1');
      expect(res.stages['screen'].ok).toBe(false);
      expect(res.stages['screen'].error).toBe('screen boom');
      expect(res.stages['publish-up'].ok).toBe(true);
      expect(res.stages['verify'].ok).toBe(true);
    });

    it('在租户上下文中执行：策略内可读 tenantId 与 chainRunId', async () => {
      const verify = strategies[6].run as jest.Mock;
      let seenTenantId = '';
      let seenTraceId = '';
      verify.mockImplementationOnce(async (ctx: OpsChainContext) => {
        // 通过模块级 TenantContext 读取（与生产一致）
        const { TenantContext } = require('../../tenant/tenant-context');
        seenTenantId = TenantContext.getTenantId() ?? '';
        seenTraceId = TenantContext.getTraceId() ?? '';
        return { recycleTaskIds: [ctx.chainRunId === seenTraceId ? 1 : 2] };
      });
      const res = await svc.runOnce('tn-9');
      expect(seenTenantId).toBe('tn-9');
      expect(seenTraceId).toBe(res.chainRunId);
    });

    it('tenant 偏好优先于默认：preferred 指定 retrieve_b 时执行它', async () => {
      const res = await svc.runOnce('tn-1', { retrieve: 'retrieve_b' });
      expect(res.stages['retrieve'].strategy).toBe('retrieve_b');
    });

    it('自动分析失败不阻断：report 标记失败但 screen 仍执行（降级旧洞察库）', async () => {
      const screen = strategies[2].run as jest.Mock;
      screen.mockClear();
      // 分析服务创建失败（如无 approved 评论）
      (svc as unknown as { analyzeService: AnalyzeService }).analyzeService = {
        createAnalysisTask: jest.fn().mockRejectedValue(new Error('ANALYSIS_EMPTY_INPUT')),
        getAnalysisTask: jest.fn().mockResolvedValue({ status: 'done' }),
      } as unknown as AnalyzeService;
      const res = await svc.runOnce('tn-1', undefined, ['retrieve', 'screen']);
      expect(res.stages['analyze'].ok).toBe(false);
      expect(res.stages['analyze'].error).toContain('ANALYSIS_EMPTY_INPUT');
      expect(res.stages['screen'].ok).toBe(true);
      expect(screen).toHaveBeenCalledTimes(1);
    });
  });

  describe('scheduledRun / setTenantPreference', () => {
    it('仅对已配置偏好的 tenant 定时运行', async () => {
      svc.setTenantPreference('tn-1', { retrieve: 'retrieve_a' });
      await svc.scheduledRun();
      expect((strategies[0].run as jest.Mock).mock.calls.length).toBe(1);
    });

    it('listRuns 记录每次运行的 stage 轨迹（含自动分析）', async () => {
      await svc.runOnce('tn-1', undefined, ['retrieve', 'screen']);
      const runs = svc.listRuns();
      expect(runs.map((r) => r.stage)).toEqual(['retrieve', 'screen', 'analyze']);
      expect(runs.every((r) => r.tenantId === 'tn-1')).toBe(true);
    });
  });
});
