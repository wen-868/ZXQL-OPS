import { IntegrationController } from './integration.controller';
import { TenantContext } from '../tenant/tenant-context';

describe('IntegrationController', () => {
  let controller: IntegrationController;
  let svc: { [k: string]: jest.Mock };

  beforeEach(() => {
    svc = { getSyncConfig: jest.fn(), updateSyncConfig: jest.fn() };
    controller = new IntegrationController(svc as any);
  });

  it('getConfig 读取租户上下文并返回信封', async () => {
    svc.getSyncConfig.mockResolvedValue({ mode: 'standalone', syncEnabled: true });
    const r = await TenantContext.run({ traceId: 't', tenantId: 'tn-1' }, () =>
      controller.getConfig(),
    );
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ mode: 'standalone', syncEnabled: true });
    expect(svc.getSyncConfig).toHaveBeenCalledWith('tn-1');
  });

  it('updateConfig 读取租户上下文并委托 updateSyncConfig(tenantId, dto)', async () => {
    const dto = { syncEnabled: false };
    svc.updateSyncConfig.mockResolvedValue({ mode: 'connected', syncEnabled: false });
    const r = await TenantContext.run({ traceId: 't', tenantId: 'tn-1' }, () =>
      controller.updateConfig(dto as any),
    );
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ mode: 'connected', syncEnabled: false });
    expect(svc.updateSyncConfig).toHaveBeenCalledWith('tn-1', dto);
  });
});
