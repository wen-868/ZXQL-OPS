import { EmployeeService } from './employee.service';
import { User } from '../../auth/user.entity';

const makeRepo = () => ({
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  create: jest.fn((e) => e),
  remove: jest.fn(),
  delete: jest.fn(),
});

describe('EmployeeService', () => {
  it('create 用户名重复抛 AUTH_USER_EXISTS', async () => {
    const userRepo = makeRepo() as any;
    userRepo.findOne.mockResolvedValue({ id: 1, username: 'admin' });
    const svc = new EmployeeService(userRepo, makeRepo() as any, makeRepo() as any);
    await expect(
      svc.create({ username: 'admin', password: '123456', role: 'editor', status: 1 }, 't_dev'),
    ).rejects.toMatchObject({ code: 'AUTH_USER_EXISTS' });
  });

  it('create 成功哈希密码', async () => {
    const userRepo = makeRepo() as any;
    userRepo.findOne.mockResolvedValue(null);
    userRepo.save.mockImplementation(async (u: User) => ({ ...u, id: 9 }));
    const svc = new EmployeeService(userRepo, makeRepo() as any, makeRepo() as any);
    const v = await svc.create(
      { username: 'alice', password: 'secret1', realName: 'Alice', role: 'editor', status: 1 },
      't_dev',
    );
    const saved = userRepo.save.mock.calls[0][0];
    expect(saved.password).not.toBe('secret1');
    expect(saved.password).toContain('$2'); // bcrypt 哈希前缀
    expect(v.username).toBe('alice');
  });

  it('assignRole 重复绑定抛 ROLE_ASSIGN_DUP', async () => {
    const userRepo = makeRepo() as any;
    const roleRepo = makeRepo() as any;
    const ruRepo = makeRepo() as any;
    userRepo.findOne.mockResolvedValue({ id: 2 });
    roleRepo.findOne.mockResolvedValue({ id: 5 });
    ruRepo.findOne.mockResolvedValue({ userId: 2, roleId: 5 });
    const svc = new EmployeeService(userRepo, roleRepo, ruRepo);
    await expect(svc.assignRole(2, 5, 't_dev')).rejects.toMatchObject({ code: 'ROLE_ASSIGN_DUP' });
  });

  it('update 不改密码时不触碰密码字段', async () => {
    const userRepo = makeRepo() as any;
    userRepo.findOne.mockResolvedValue({
      id: 3,
      username: 'bob',
      status: 1,
      tenantId: 't_dev',
    });
    userRepo.save.mockImplementation(async (u: any) => ({ ...u }));
    const svc = new EmployeeService(userRepo, makeRepo() as any, makeRepo() as any);
    await svc.update(3, { status: 0 }, 't_dev');
    expect(userRepo.save.mock.calls[0][0].password).toBeUndefined();
    expect(userRepo.save.mock.calls[0][0].status).toBe(0);
  });
});
