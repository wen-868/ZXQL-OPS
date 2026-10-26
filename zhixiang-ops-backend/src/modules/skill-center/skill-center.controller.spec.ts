import { SkillCenterController } from './skill-center.controller';
import { TenantContext } from '../../tenant/tenant-context';

describe('SkillCenterController', () => {
  let controller: SkillCenterController;
  let svc: { [k: string]: jest.Mock };

  beforeEach(() => {
    svc = {
      getMarket: jest.fn(),
      listProviders: jest.fn(),
      createProvider: jest.fn(),
      deleteProvider: jest.fn(),
      getInstalled: jest.fn(),
      install: jest.fn(),
      uninstall: jest.fn(),
      setProvider: jest.fn(),
    };
    controller = new SkillCenterController(svc as any);
  });

  it('market 读取租户并返回 { list }', async () => {
    svc.getMarket.mockResolvedValue([{ id: 1 }]);
    const r = await TenantContext.run({ traceId: 't', tenantId: 'tn-1' }, () =>
      controller.market(),
    );
    expect(r.list).toEqual([{ id: 1 }]);
    expect(svc.getMarket).toHaveBeenCalledWith('tn-1');
  });

  it('providers 读取租户并返回 { list }', async () => {
    svc.listProviders.mockResolvedValue([{ id: 1 }]);
    const r = await TenantContext.run({ traceId: 't', tenantId: 'tn-1' }, () =>
      controller.providers(),
    );
    expect(r.list).toEqual([{ id: 1 }]);
    expect(svc.listProviders).toHaveBeenCalledWith('tn-1');
  });

  it('installed 读取租户并返回 { list }', async () => {
    svc.getInstalled.mockResolvedValue([{ id: 2 }]);
    const r = await TenantContext.run({ traceId: 't', tenantId: 'tn-1' }, () =>
      controller.installed(),
    );
    expect(r.list).toEqual([{ id: 2 }]);
    expect(svc.getInstalled).toHaveBeenCalledWith('tn-1');
  });

  it('createProvider 读取租户并直接返回 service 结果', async () => {
    const dto = { name: 'byo' };
    svc.createProvider.mockResolvedValue({ id: 3 });
    const r = await TenantContext.run({ traceId: 't', tenantId: 'tn-1' }, () =>
      controller.createProvider(dto as any),
    );
    expect(r).toEqual({ id: 3 });
    expect(svc.createProvider).toHaveBeenCalledWith('tn-1', dto);
  });

  it('deleteProvider 读取租户并直接返回 service 结果', async () => {
    svc.deleteProvider.mockResolvedValue({ deleted: true });
    const r = await TenantContext.run({ traceId: 't', tenantId: 'tn-1' }, () =>
      controller.deleteProvider('3'),
    );
    expect(r).toEqual({ deleted: true });
    expect(svc.deleteProvider).toHaveBeenCalledWith('tn-1', 3);
  });

  it('install 读取租户并直接返回 service 结果', async () => {
    const dto = { providerId: 'p1' };
    svc.install.mockResolvedValue({ installed: true });
    const r = await TenantContext.run({ traceId: 't', tenantId: 'tn-1' }, () =>
      controller.install('4', dto as any),
    );
    expect(r).toEqual({ installed: true });
    expect(svc.install).toHaveBeenCalledWith('tn-1', 4, 'p1');
  });

  it('uninstall 读取租户并直接返回 service 结果', async () => {
    svc.uninstall.mockResolvedValue({ uninstalled: true });
    const r = await TenantContext.run({ traceId: 't', tenantId: 'tn-1' }, () =>
      controller.uninstall('4'),
    );
    expect(r).toEqual({ uninstalled: true });
    expect(svc.uninstall).toHaveBeenCalledWith('tn-1', 4);
  });

  it('setProvider 读取租户并直接返回 service 结果', async () => {
    const dto = { providerId: 'p2' };
    svc.setProvider.mockResolvedValue({ set: true });
    const r = await TenantContext.run({ traceId: 't', tenantId: 'tn-1' }, () =>
      controller.setProvider('4', dto as any),
    );
    expect(r).toEqual({ set: true });
    expect(svc.setProvider).toHaveBeenCalledWith('tn-1', 4, 'p2');
  });
});
