import { RoleController } from './role.controller';

describe('RoleController', () => {
  let controller: RoleController;
  let roleService: { [k: string]: jest.Mock };

  beforeEach(() => {
    roleService = {
      create: jest.fn(),
      list: jest.fn(),
      getUserRoles: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      assign: jest.fn(),
      unassign: jest.fn(),
    };
    controller = new RoleController(roleService as any);
  });

  it('create 委托 roleService.create 并原样返回', async () => {
    const dto = { name: 'r' } as any;
    roleService.create.mockResolvedValue({ id: 1 });
    await expect(controller.create(dto)).resolves.toEqual({ id: 1 });
    expect(roleService.create).toHaveBeenCalledWith(dto);
  });

  it('list 透传分页参数并原样返回', async () => {
    const q = { page: 2, pageSize: 10 } as any;
    roleService.list.mockResolvedValue({ items: [] });
    await expect(controller.list(q)).resolves.toEqual({ items: [] });
    expect(roleService.list).toHaveBeenCalledWith({ page: 2, pageSize: 10 });
  });

  it('list 缺省分页参数时使用默认值', async () => {
    const q = {} as any;
    roleService.list.mockResolvedValue({ items: [] });
    await expect(controller.list(q)).resolves.toEqual({ items: [] });
    expect(roleService.list).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
  });

  it('userRoles 将 userId 转换为 Number 并原样返回', async () => {
    roleService.getUserRoles.mockResolvedValue(['admin']);
    await expect(controller.userRoles('7')).resolves.toEqual(['admin']);
    expect(roleService.getUserRoles).toHaveBeenCalledWith(7);
  });

  it('get 将 id 转换为 Number 并原样返回', async () => {
    roleService.get.mockResolvedValue({ id: 2 });
    await expect(controller.get('2')).resolves.toEqual({ id: 2 });
    expect(roleService.get).toHaveBeenCalledWith(2);
  });

  it('update 将 id 转换为 Number 并原样返回', async () => {
    const dto = { name: 'r2' } as any;
    roleService.update.mockResolvedValue({ id: 3 });
    await expect(controller.update('3', dto)).resolves.toEqual({ id: 3 });
    expect(roleService.update).toHaveBeenCalledWith(3, dto);
  });

  it('remove 将 id 转换为 Number 并原样返回', async () => {
    roleService.remove.mockResolvedValue({ removed: true });
    await expect(controller.remove('4')).resolves.toEqual({ removed: true });
    expect(roleService.remove).toHaveBeenCalledWith(4);
  });

  it('assign 将 id 转换为 Number 并透传 userId', async () => {
    const dto = { userId: 9 } as any;
    roleService.assign.mockResolvedValue({ ok: true });
    await expect(controller.assign('5', dto)).resolves.toEqual({ ok: true });
    expect(roleService.assign).toHaveBeenCalledWith(5, 9);
  });

  it('unassign 将 id 与 userId 转换为 Number 并原样返回', async () => {
    roleService.unassign.mockResolvedValue({ ok: true });
    await expect(controller.unassign('6', '10')).resolves.toEqual({ ok: true });
    expect(roleService.unassign).toHaveBeenCalledWith(6, 10);
  });
});
