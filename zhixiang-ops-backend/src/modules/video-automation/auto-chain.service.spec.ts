import { Logger } from '@nestjs/common';
import { VideoAutoChainService } from './auto-chain.service';
import { VideoStrategyRegistry } from './video-strategy.registry';
import {
  StrategyMeta,
  VideoChainContext,
  VideoStage,
  VideoStageResult,
  VIDEO_STAGES,
} from './video-automation.types';

/**
 * 视频全链路编排器测试。
 * 覆盖：
 * - onModuleInit：注册全部策略、统计各阶段数量、阶段 <5 时告警（≥5 不告警）
 * - setTenantPreference：新建 / 合并同一 tenant 的偏好
 * - runOnce：全阶段成功并沿 ctx 透传产物（absorb）、产物缺失时保留 ctx 原值、
 *   某阶段无策略降级、run 抛 Error / 非 Error、preferred 覆盖 tenant 偏好
 * - scheduledRun：遍历 tenant 执行，单个 tenant 失败仅记录不中断
 * - listRuns：返回最近 50 条运行记录
 */

const STAGE_FIELD: Record<VideoStage, keyof VideoStageResult> = {
  intel: 'collectTaskIds',
  analyze: 'analysisTaskIds',
  topic: 'topicIds',
  script: 'scriptIds',
  material: 'materialIds',
  compose: 'videoIds',
  publish: 'publishTaskIds',
  recycle: 'recycleTaskIds',
};

type MockStrategy = {
  meta: StrategyMeta;
  run: jest.Mock;
};

type RegistryMock = {
  registerAll: jest.Mock;
  countByStage: jest.Mock;
  resolve: jest.Mock;
};

function makeStrategy(
  stage: VideoStage,
  runImpl: (ctx: VideoChainContext) => Promise<VideoStageResult>,
): MockStrategy {
  return {
    meta: {
      key: `${stage}_strategy`,
      stage,
      name: `策略-${stage}`,
      tech: 'rule',
      impl: 'rule',
      scenarios: [],
      enabledByDefault: true,
      desc: '',
    },
    run: jest.fn(runImpl),
  };
}

function makeService(
  byStage: Map<VideoStage, MockStrategy>,
  resolveImpl?: (stage: VideoStage, key?: string) => MockStrategy | undefined,
): { service: VideoAutoChainService; registry: RegistryMock; strategies: MockStrategy[] } {
  const registry: RegistryMock = {
    registerAll: jest.fn(),
    countByStage: jest.fn(),
    resolve: jest.fn(resolveImpl ?? ((stage: VideoStage) => byStage.get(stage))),
  };
  const strategies = [...byStage.values()];
  const service = new VideoAutoChainService(
    registry as unknown as VideoStrategyRegistry,
    strategies,
  );
  return { service, registry, strategies };
}

describe('VideoAutoChainService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('onModuleInit 注册全部策略，阶段不足 5 个时告警', () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const byStage = new Map<VideoStage, MockStrategy>();
    for (const s of VIDEO_STAGES)
      byStage.set(
        s,
        makeStrategy(s, async () => ({ strategy: `${s}_strategy` })),
      );
    const { service, registry } = makeService(byStage);
    registry.countByStage.mockImplementation((stage: VideoStage) => (stage === 'recycle' ? 4 : 6));
    service.onModuleInit();
    expect(registry.registerAll).toHaveBeenCalledWith([...byStage.values()]);
    expect(registry.countByStage).toHaveBeenCalledTimes(VIDEO_STAGES.length);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('recycle'));
  });

  it('onModuleInit 各阶段均 ≥5 时不告警', () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const byStage = new Map<VideoStage, MockStrategy>();
    for (const s of VIDEO_STAGES)
      byStage.set(
        s,
        makeStrategy(s, async () => ({ strategy: `${s}_strategy` })),
      );
    const { service, registry } = makeService(byStage);
    registry.countByStage.mockReturnValue(5);
    service.onModuleInit();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('setTenantPreference 合并同一 tenant 的偏好并在 runOnce 中使用', async () => {
    const resolveCalls: Array<[VideoStage, string | undefined]> = [];
    const { service } = makeService(new Map(), (stage, key) => {
      resolveCalls.push([stage, key]);
      return undefined;
    });
    service.setTenantPreference('t1', { intel: 'intel_a' });
    service.setTenantPreference('t1', { topic: 'topic_b' });
    await service.runOnce('t1');
    expect(resolveCalls).toContainEqual(['intel', 'intel_a']);
    expect(resolveCalls).toContainEqual(['topic', 'topic_b']);
  });

  it('runOnce 的 preferred 覆盖 tenant 偏好', async () => {
    const resolveCalls: Array<[VideoStage, string | undefined]> = [];
    const { service } = makeService(new Map(), (stage, key) => {
      resolveCalls.push([stage, key]);
      return undefined;
    });
    service.setTenantPreference('t1', { intel: 'intel_from_pref' });
    await service.runOnce('t1', { intel: 'intel_preferred' });
    expect(resolveCalls).toContainEqual(['intel', 'intel_preferred']);
  });

  it('runOnce 全阶段成功并沿 ctx 透传各阶段产物', async () => {
    const byStage = new Map<VideoStage, MockStrategy>();
    for (const [i, s] of VIDEO_STAGES.entries()) {
      byStage.set(
        s,
        makeStrategy(s, async () => {
          const detail: VideoStageResult = { strategy: `${s}_strategy` };
          (detail as unknown as Record<string, unknown>)[STAGE_FIELD[s]] = [i + 1];
          return detail;
        }),
      );
    }
    const { service, registry, strategies } = makeService(byStage);
    const res = await service.runOnce('t1');
    expect(res.chainRunId).toBeDefined();
    expect(registry.resolve).toHaveBeenCalledTimes(VIDEO_STAGES.length);
    for (const [i, s] of VIDEO_STAGES.entries()) {
      expect(res.stages[s]).toMatchObject({ strategy: `${s}_strategy`, ok: true });
      expect(res.stages[s].detail).toMatchObject({ [STAGE_FIELD[s]]: [i + 1] });
    }
    // absorb：最后一个阶段收到的 ctx 已含全部 8 项产物
    const lastCtx = strategies[VIDEO_STAGES.length - 1].run.mock.calls[0][0] as VideoChainContext;
    for (const [i, s] of VIDEO_STAGES.entries()) {
      expect((lastCtx as unknown as Record<string, unknown>)[STAGE_FIELD[s]]).toEqual([i + 1]);
    }
  });

  it('runOnce 阶段产物缺失时保留 ctx 原值（absorb 空值兜底）', async () => {
    const byStage = new Map<VideoStage, MockStrategy>();
    for (const s of VIDEO_STAGES)
      byStage.set(
        s,
        makeStrategy(s, async () => ({ strategy: `${s}_strategy` })),
      );
    const { service, strategies } = makeService(byStage);
    const res = await service.runOnce('t1');
    const lastCtx = strategies[VIDEO_STAGES.length - 1].run.mock.calls[0][0] as VideoChainContext;
    for (const s of VIDEO_STAGES) {
      expect((lastCtx as unknown as Record<string, unknown>)[STAGE_FIELD[s]]).toBeUndefined();
      expect(res.stages[s].ok).toBe(true);
    }
  });

  it('runOnce 某阶段无策略时降级为 no strategy registered 且不中断', async () => {
    const byStage = new Map<VideoStage, MockStrategy>();
    for (const s of VIDEO_STAGES)
      byStage.set(
        s,
        makeStrategy(s, async () => ({ strategy: `${s}_strategy` })),
      );
    const { service } = makeService(byStage, (stage) =>
      stage === 'publish' ? undefined : byStage.get(stage),
    );
    const res = await service.runOnce('t1');
    expect(res.stages.publish).toEqual({
      strategy: 'none',
      ok: false,
      error: 'no strategy registered',
    });
    expect(res.stages.compose.ok).toBe(true);
    expect(res.stages.recycle.ok).toBe(true);
  });

  it('runOnce 阶段 run 抛 Error 时记录错误信息且不中断', async () => {
    const byStage = new Map<VideoStage, MockStrategy>();
    for (const s of VIDEO_STAGES) {
      byStage.set(
        s,
        makeStrategy(s, async () => {
          if (s === 'material') throw new Error('FFMPEG_MISSING');
          return { strategy: `${s}_strategy` };
        }),
      );
    }
    const { service } = makeService(byStage);
    const res = await service.runOnce('t1');
    expect(res.stages.material).toMatchObject({
      strategy: 'material_strategy',
      ok: false,
      error: 'FFMPEG_MISSING',
    });
    expect(res.stages.compose.ok).toBe(true);
  });

  it('runOnce 阶段 run 抛非 Error 时 error 为 String 化结果', async () => {
    const byStage = new Map<VideoStage, MockStrategy>();
    for (const s of VIDEO_STAGES) {
      byStage.set(
        s,
        makeStrategy(s, async () => {
          const boom: unknown = 'raw-boom';
          if (s === 'script') throw boom;
          return { strategy: `${s}_strategy` };
        }),
      );
    }
    const { service } = makeService(byStage);
    const res = await service.runOnce('t1');
    expect(res.stages.script).toMatchObject({ ok: false, error: 'raw-boom' });
  });

  it('scheduledRun 遍历 tenant 执行，单 tenant 失败仅记录', async () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { service } = makeService(new Map<VideoStage, MockStrategy>());
    service.setTenantPreference('t1', { intel: 'a' });
    service.setTenantPreference('t2', { intel: 'b' });
    const runSpy = jest
      .spyOn(service, 'runOnce')
      .mockResolvedValueOnce({ chainRunId: 'r1', stages: {} })
      .mockRejectedValueOnce(new Error('redis down'));
    await service.scheduledRun();
    expect(runSpy).toHaveBeenCalledTimes(2);
    expect(runSpy).toHaveBeenCalledWith('t1');
    expect(runSpy).toHaveBeenCalledWith('t2');
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('t2'));
  });

  it('listRuns 返回最近 50 条运行记录', async () => {
    const byStage = new Map<VideoStage, MockStrategy>();
    for (const s of VIDEO_STAGES)
      byStage.set(
        s,
        makeStrategy(s, async () => ({ strategy: `${s}_strategy` })),
      );
    const { service } = makeService(byStage);
    await service.runOnce('t1');
    const runs = service.listRuns();
    expect(runs).toHaveLength(VIDEO_STAGES.length);
    expect(runs[0]).toMatchObject({ tenantId: 't1', stage: 'intel' });
  });
});
