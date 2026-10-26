import { VideoAutomationController } from './video-automation.controller';
import { TenantContext } from '../../tenant/tenant-context';

describe('VideoAutomationController', () => {
  let controller: VideoAutomationController;
  let autoChain: { [k: string]: jest.Mock };
  let registry: { [k: string]: jest.Mock };

  beforeEach(() => {
    autoChain = { runOnce: jest.fn(), setTenantPreference: jest.fn(), listRuns: jest.fn() };
    registry = { countByStage: jest.fn(), metasByStage: jest.fn() };
    controller = new VideoAutomationController(autoChain as any, registry as any);
  });

  it('listStrategies 指定 stage 时返回该阶段统计与策略', () => {
    registry.countByStage.mockReturnValue(3);
    registry.metasByStage.mockReturnValue([{ key: 'script_a' }]);
    const r = controller.listStrategies('script');
    expect(r).toEqual({
      stage: 'script',
      count: 3,
      strategies: [{ key: 'script_a' }],
    });
    expect(registry.countByStage).toHaveBeenCalledWith('script');
    expect(registry.metasByStage).toHaveBeenCalledWith('script');
  });

  it('listStrategies 未指定 stage 时返回全部阶段统计', () => {
    registry.countByStage.mockReturnValue(0);
    registry.metasByStage.mockReturnValue([]);
    const r = controller.listStrategies() as { stage: string }[];
    expect(r).toHaveLength(8);
    expect(r[0].stage).toBe('intel');
    expect(r[7].stage).toBe('recycle');
    expect(registry.countByStage).toHaveBeenCalledTimes(8);
  });

  it('runOnce 使用 body.tenantId 时跳过租户上下文', async () => {
    autoChain.runOnce.mockResolvedValue({ runId: 'v1' });
    const body = { tenantId: 'tn-x', prefer: { topic: 'a' } };
    const r = await controller.runOnce(body);
    expect(r).toEqual({ runId: 'v1' });
    expect(autoChain.runOnce).toHaveBeenCalledWith('tn-x', { topic: 'a' });
  });

  it('runOnce 未传 tenantId 时读取租户上下文', async () => {
    autoChain.runOnce.mockResolvedValue({ runId: 'v2' });
    const r = await TenantContext.run({ traceId: 't', tenantId: 'tn-1' }, () =>
      controller.runOnce({ prefer: {} } as any),
    );
    expect(r).toEqual({ runId: 'v2' });
    expect(autoChain.runOnce).toHaveBeenCalledWith('tn-1', {});
  });

  it('setPref 使用 body.tenantId 时跳过租户上下文', () => {
    const body = { tenantId: 'tn-x', pref: { publish: 'b' } };
    const r = controller.setPref(body);
    expect(r).toEqual({ ok: true });
    expect(autoChain.setTenantPreference).toHaveBeenCalledWith('tn-x', { publish: 'b' });
  });

  it('setPref 未传 tenantId 时读取租户上下文', () => {
    const body = { pref: { compose: 'c' } };
    const r = TenantContext.run({ traceId: 't', tenantId: 'tn-1' }, () =>
      controller.setPref(body as any),
    );
    expect(r).toEqual({ ok: true });
    expect(autoChain.setTenantPreference).toHaveBeenCalledWith('tn-1', { compose: 'c' });
  });

  it('runs 委托 autoChain.listRuns', () => {
    autoChain.listRuns.mockReturnValue([{ runId: 'v1' }]);
    const r = controller.runs();
    expect(r).toEqual([{ runId: 'v1' }]);
    expect(autoChain.listRuns).toHaveBeenCalledTimes(1);
  });
});
