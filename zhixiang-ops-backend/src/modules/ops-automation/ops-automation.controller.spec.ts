import { OpsAutomationController } from './ops-automation.controller';
import { TenantContext } from '../../tenant/tenant-context';

describe('OpsAutomationController', () => {
  let controller: OpsAutomationController;
  let autoChain: { [k: string]: jest.Mock };
  let registry: { [k: string]: jest.Mock };

  beforeEach(() => {
    autoChain = { runOnce: jest.fn(), setTenantPreference: jest.fn(), listRuns: jest.fn() };
    registry = { countByStage: jest.fn(), metasByStage: jest.fn() };
    controller = new OpsAutomationController(autoChain as any, registry as any);
  });

  it('listStrategies 指定 stage 时返回该阶段统计与策略', () => {
    registry.countByStage.mockReturnValue(2);
    registry.metasByStage.mockReturnValue([{ key: 'deliver_a' }]);
    const r = controller.listStrategies('deliver');
    expect(r).toEqual({
      stage: 'deliver',
      count: 2,
      strategies: [{ key: 'deliver_a' }],
    });
    expect(registry.countByStage).toHaveBeenCalledWith('deliver');
    expect(registry.metasByStage).toHaveBeenCalledWith('deliver');
  });

  it('listStrategies 未指定 stage 时返回全部阶段统计', () => {
    registry.countByStage.mockReturnValue(0);
    registry.metasByStage.mockReturnValue([]);
    const r = controller.listStrategies() as { stage: string }[];
    expect(r).toHaveLength(5);
    expect(r[0].stage).toBe('retrieve');
    expect(r[4].stage).toBe('verify');
    expect(registry.countByStage).toHaveBeenCalledTimes(5);
  });

  it('runOnce 使用 body.tenantId 时跳过租户上下文', async () => {
    autoChain.runOnce.mockResolvedValue({ runId: 'r1' });
    const body = { tenantId: 'tn-x', prefer: { retrieve: 'a' }, stages: ['retrieve'] };
    const r = await controller.runOnce(body as any);
    expect(r).toEqual({ runId: 'r1' });
    expect(autoChain.runOnce).toHaveBeenCalledWith('tn-x', { retrieve: 'a' }, ['retrieve']);
  });

  it('runOnce 未传 tenantId 时读取租户上下文', async () => {
    autoChain.runOnce.mockResolvedValue({ runId: 'r2' });
    const r = await TenantContext.run({ traceId: 't', tenantId: 'tn-1' }, () =>
      controller.runOnce({ prefer: {} } as any),
    );
    expect(r).toEqual({ runId: 'r2' });
    expect(autoChain.runOnce).toHaveBeenCalledWith('tn-1', {}, undefined);
  });

  it('setPref 使用 body.tenantId 时跳过租户上下文', () => {
    const body = { tenantId: 'tn-x', pref: { deliver: 'b' } };
    const r = controller.setPref(body);
    expect(r).toEqual({ ok: true });
    expect(autoChain.setTenantPreference).toHaveBeenCalledWith('tn-x', { deliver: 'b' });
  });

  it('setPref 未传 tenantId 时读取租户上下文', () => {
    const body = { pref: { verify: 'c' } };
    const r = TenantContext.run({ traceId: 't', tenantId: 'tn-1' }, () =>
      controller.setPref(body as any),
    );
    expect(r).toEqual({ ok: true });
    expect(autoChain.setTenantPreference).toHaveBeenCalledWith('tn-1', { verify: 'c' });
  });

  it('runs 委托 autoChain.listRuns', () => {
    autoChain.listRuns.mockReturnValue([{ runId: 'r1' }]);
    const r = controller.runs();
    expect(r).toEqual([{ runId: 'r1' }]);
    expect(autoChain.listRuns).toHaveBeenCalledTimes(1);
  });
});
