import { EmployeeService } from './employee.service';
import { User } from '../../auth/user.entity';
import { RoleUserEntity } from '../n/role-user.entity';

/**
 * EmployeeService（员工管理）单元测试。
 * 覆盖：列表（分页/关键字/状态过滤/RBAC 拼装）、角色列表、创建、更新、删除、详情、角色分配/解绑。
 */
const TENANT = 'tn-1';

function makeUser(over: Partial<User> = {}): User {
  return {
    id: 1,
    username: 'zhang',
    realName: '张三',
    password: 'x',
    role: 'ops_admin',
    type: 'standalone',
    status: 1,
    tenantId: TENANT,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

function buildService() {
  const userRepo = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((e: Partial<User>) => e as User),
    save: jest.fn(async (u: User) => u),
    remove: jest.fn(async (u: User) => u),
  };
  const roleRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
  };
  const ruRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((e: Partial<RoleUserEntity>) => e as RoleUserEntity),
    save: jest.fn(async (e: RoleUserEntity) => e),
    delete: jest.fn(),
    remove: jest.fn(async (e: RoleUserEntity) => e),
  };
  const svc = new EmployeeService(userRepo as never, roleRepo as never, ruRepo as never);
  return { svc, userRepo, roleRepo, ruRepo };
}

describe('EmployeeService', () => {
  it('list 无关键字：按 tenantId 过滤 + 分页 + RBAC 角色拼装', async () => {
    const { svc, userRepo, roleRepo, ruRepo } = buildService();
    const users = [makeUser({ id: 1 }), makeUser({ id: 2, username: 'li' })];
    userRepo.findAndCount.mockResolvedValueOnce([users, 2]);
    ruRepo.find.mockResolvedValueOnce([
      { userId: 1, roleId: 10 },
      { userId: 2, roleId: 11 },
    ] as never);
    roleRepo.find.mockResolvedValueOnce([
      { id: 10, name: '运营' },
      { id: 11, name: '客服' },
    ] as never);

    const page = await svc.list({ page: 1, pageSize: 10 }, TENANT);

    expect(page.total).toBe(2);
    expect(page.list[0].roles).toEqual([{ id: 10, name: '运营' }]);
    expect(page.list[1].roles).toEqual([{ id: 11, name: '客服' }]);
    expect(userRepo.findAndCount.mock.calls[0][0].where).toEqual({ tenantId: TENANT });
  });

  it('list 带关键字与状态：OR 条件（username/realName Like）', async () => {
    const { svc, userRepo } = buildService();
    userRepo.findAndCount.mockResolvedValueOnce([[], 0]);
    await svc.list({ page: 1, pageSize: 10, keyword: '张', status: 1 }, TENANT);
    const where = userRepo.findAndCount.mock.calls[0][0].where as Array<Record<string, unknown>>;
    expect(where).toHaveLength(2);
    expect(where[0]).toMatchObject({ tenantId: TENANT, status: 1 });
    expect(where[1]).toMatchObject({ tenantId: TENANT, status: 1 });
  });

  it('listRoles 返回角色基础视图', async () => {
    const { svc, roleRepo } = buildService();
    roleRepo.find.mockResolvedValueOnce([
      { id: 3, name: '运营', description: 'd', isSystem: 1 },
    ] as never);
    const roles = await svc.listRoles(TENANT);
    expect(roles[0]).toEqual({ id: 3, name: '运营', description: 'd', isSystem: 1 });
    expect(roleRepo.find).toHaveBeenCalledWith({
      where: { tenantId: TENANT },
      order: { id: 'ASC' },
    });
  });

  it('create 用户名重复抛 AUTH_USER_EXISTS；成功时密码加密', async () => {
    const { svc, userRepo } = buildService();
    userRepo.findOne.mockResolvedValueOnce(makeUser());
    await expect(svc.create({ username: 'zhang', password: 'p' }, TENANT)).rejects.toMatchObject({
      code: 'AUTH_USER_EXISTS',
    });

    userRepo.findOne.mockResolvedValueOnce(null);
    const created = await svc.create({ username: 'newbie', password: 'secret' }, TENANT);
    expect(created.username).toBe('newbie');
    expect(created.role).toBe('editor');
    const saved = userRepo.create.mock.calls[0][0] as User;
    expect(saved.password).not.toBe('secret');
    expect(saved.tenantId).toBe(TENANT);
  });

  it('update 仅更新提供的字段并加密新密码', async () => {
    const { svc, userRepo } = buildService();
    userRepo.findOne.mockResolvedValueOnce(makeUser());
    await svc.update(1, { realName: '李四', status: 0, password: 'newp' }, TENANT);
    const saved = userRepo.save.mock.calls[0][0];
    expect(saved.realName).toBe('李四');
    expect(saved.status).toBe(0);
    expect(saved.password).not.toBe('newp');
  });

  it('update 用户不存在抛 AUTH_USER_NOT_FOUND', async () => {
    const { svc, userRepo } = buildService();
    userRepo.findOne.mockResolvedValueOnce(null);
    await expect(svc.update(9, { role: 'x' }, TENANT)).rejects.toMatchObject({
      code: 'AUTH_USER_NOT_FOUND',
    });
  });

  it('remove 删除用户关联角色后移除用户（租户隔离）', async () => {
    const { svc, userRepo, ruRepo } = buildService();
    userRepo.findOne.mockResolvedValueOnce(makeUser());
    const r = await svc.remove(1, TENANT);
    expect(ruRepo.delete).toHaveBeenCalledWith({ userId: 1 });
    expect(userRepo.remove).toHaveBeenCalled();
    expect(r).toEqual({ id: 1 });
  });

  it('remove 用户不存在抛 AUTH_USER_NOT_FOUND', async () => {
    const { svc, userRepo } = buildService();
    userRepo.findOne.mockResolvedValueOnce(null);
    await expect(svc.remove(9, TENANT)).rejects.toMatchObject({ code: 'AUTH_USER_NOT_FOUND' });
  });

  it('detail 返回用户+角色', async () => {
    const { svc, userRepo, roleRepo, ruRepo } = buildService();
    userRepo.findOne.mockResolvedValue(makeUser());
    ruRepo.find.mockResolvedValueOnce([{ userId: 1, roleId: 10 }] as never);
    roleRepo.find.mockResolvedValueOnce([{ id: 10, name: '运营' }] as never);
    const d = await svc.detail(1, TENANT);
    expect(d.username).toBe('zhang');
    expect(d.roles).toEqual([{ id: 10, name: '运营' }]);
  });

  it('getRoles 用户不存在抛 AUTH_USER_NOT_FOUND', async () => {
    const { svc, userRepo } = buildService();
    userRepo.findOne.mockResolvedValueOnce(null);
    await expect(svc.getRoles(9, TENANT)).rejects.toMatchObject({ code: 'AUTH_USER_NOT_FOUND' });
  });

  it('assignRole 用户/角色校验、重复分配拒绝', async () => {
    const { svc, userRepo, roleRepo, ruRepo } = buildService();
    userRepo.findOne.mockResolvedValueOnce(makeUser());
    roleRepo.findOne.mockResolvedValueOnce({ id: 10, tenantId: TENANT });
    ruRepo.findOne.mockResolvedValueOnce(null);
    const r = await svc.assignRole(1, 10, TENANT);
    expect(r).toEqual({ userId: 1, roleId: 10 });

    userRepo.findOne.mockResolvedValueOnce(makeUser());
    roleRepo.findOne.mockResolvedValueOnce({ id: 10, tenantId: TENANT });
    ruRepo.findOne.mockResolvedValueOnce({ userId: 1, roleId: 10 });
    await expect(svc.assignRole(1, 10, TENANT)).rejects.toMatchObject({ code: 'ROLE_ASSIGN_DUP' });
  });

  it('assignRole 角色不存在抛 ROLE_NOT_FOUND', async () => {
    const { svc, userRepo, roleRepo } = buildService();
    userRepo.findOne.mockResolvedValueOnce(makeUser());
    roleRepo.findOne.mockResolvedValueOnce(null);
    await expect(svc.assignRole(1, 99, TENANT)).rejects.toMatchObject({ code: 'ROLE_NOT_FOUND' });
  });

  it('unassignRole 解绑，不存在抛 ROLE_USER_NOT_FOUND', async () => {
    const { svc, ruRepo } = buildService();
    ruRepo.findOne.mockResolvedValueOnce({ userId: 1, roleId: 10 });
    const r = await svc.unassignRole(1, 10, TENANT);
    expect(r).toEqual({ userId: 1, roleId: 10 });

    ruRepo.findOne.mockResolvedValueOnce(null);
    await expect(svc.unassignRole(1, 10, TENANT)).rejects.toMatchObject({
      code: 'ROLE_USER_NOT_FOUND',
    });
  });
});
