import { EmployeeController } from './employee.controller';
import { TenantContext } from '../../tenant/tenant-context';

describe('EmployeeController', () => {
  let controller: EmployeeController;
  let svc: { [k: string]: jest.Mock };

  beforeEach(() => {
    svc = {
      list: jest.fn(),
      listRoles: jest.fn(),
      detail: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      getRoles: jest.fn(),
      assignRole: jest.fn(),
      unassignRole: jest.fn(),
    };
    controller = new EmployeeController(svc as any);
  });

  it('list 读取租户上下文并原样返回', async () => {
    const q = { page: 1 } as any;
    svc.list.mockResolvedValue({ items: [] });
    const r = await TenantContext.run({ traceId: 't-c1', tenantId: 'tn-1' }, () =>
      controller.list(q),
    );
    expect(r).toEqual({ items: [] });
    expect(svc.list).toHaveBeenCalledWith(q, 'tn-1');
  });

  it('listRoles 读取租户上下文并原样返回', async () => {
    svc.listRoles.mockResolvedValue([{ id: 1 }]);
    const r = await TenantContext.run({ traceId: 't-c2', tenantId: 'tn-1' }, () =>
      controller.listRoles(),
    );
    expect(r).toEqual([{ id: 1 }]);
    expect(svc.listRoles).toHaveBeenCalledWith('tn-1');
  });

  it('detail 直接透传数字 id 并读取租户上下文', async () => {
    svc.detail.mockResolvedValue({ id: 2 });
    const r = await TenantContext.run({ traceId: 't-c3', tenantId: 'tn-1' }, () =>
      controller.detail(2),
    );
    expect(r).toEqual({ id: 2 });
    expect(svc.detail).toHaveBeenCalledWith(2, 'tn-1');
  });

  it('create 委托 svc.create 并读取租户上下文', async () => {
    const dto = { username: 'u' } as any;
    svc.create.mockResolvedValue({ id: 3 });
    const r = await TenantContext.run({ traceId: 't-c4', tenantId: 'tn-1' }, () =>
      controller.create(dto),
    );
    expect(r).toEqual({ id: 3 });
    expect(svc.create).toHaveBeenCalledWith(dto, 'tn-1');
  });

  it('update 直接透传数字 id 并读取租户上下文', async () => {
    const dto = { displayName: 'n' } as any;
    svc.update.mockResolvedValue({ id: 4 });
    const r = await TenantContext.run({ traceId: 't-c5', tenantId: 'tn-1' }, () =>
      controller.update(4, dto),
    );
    expect(r).toEqual({ id: 4 });
    expect(svc.update).toHaveBeenCalledWith(4, dto, 'tn-1');
  });

  it('remove 直接透传数字 id 并读取租户上下文', async () => {
    svc.remove.mockResolvedValue({ removed: true });
    const r = await TenantContext.run({ traceId: 't-c6', tenantId: 'tn-1' }, () =>
      controller.remove(5),
    );
    expect(r).toEqual({ removed: true });
    expect(svc.remove).toHaveBeenCalledWith(5, 'tn-1');
  });

  it('getRoles 直接透传数字 id 并读取租户上下文', async () => {
    svc.getRoles.mockResolvedValue(['admin']);
    const r = await TenantContext.run({ traceId: 't-c7', tenantId: 'tn-1' }, () =>
      controller.getRoles(6),
    );
    expect(r).toEqual(['admin']);
    expect(svc.getRoles).toHaveBeenCalledWith(6, 'tn-1');
  });

  it('assign 直接透传数字 id 并解构 roleId、读取租户上下文', async () => {
    const dto = { roleId: 8 } as any;
    svc.assignRole.mockResolvedValue({ ok: true });
    const r = await TenantContext.run({ traceId: 't-c8', tenantId: 'tn-1' }, () =>
      controller.assign(7, dto),
    );
    expect(r).toEqual({ ok: true });
    expect(svc.assignRole).toHaveBeenCalledWith(7, 8, 'tn-1');
  });

  it('unassign 直接透传数字 id 与 roleId 并读取租户上下文', async () => {
    svc.unassignRole.mockResolvedValue({ ok: true });
    const r = await TenantContext.run({ traceId: 't-c9', tenantId: 'tn-1' }, () =>
      controller.unassign(9, 10),
    );
    expect(r).toEqual({ ok: true });
    expect(svc.unassignRole).toHaveBeenCalledWith(9, 10, 'tn-1');
  });
});
