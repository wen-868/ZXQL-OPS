import { SystemService } from './system.service';
import { User } from '../../auth/user.entity';
import { TenantContext } from '../../tenant/tenant-context';
import { env } from '../../config/env';

const makeRepo = () => ({
  count: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn((e) => e),
});

describe('SystemService', () => {
  const makeDemoService = () => ({ clearDemoData: jest.fn().mockResolvedValue(0) });

  it('getStatus 正确汇总初始化状态', async () => {
    const userRepo = makeRepo() as any;
    const roleRepo = makeRepo() as any;
    const wordRepo = makeRepo() as any;
    const demoService = makeDemoService();
    userRepo.count.mockResolvedValue(1); // admin 存在
    roleRepo.count.mockResolvedValue(3); // 默认角色齐全
    wordRepo.count.mockResolvedValue(15);
    const svc = new SystemService(userRepo, roleRepo, wordRepo, demoService as never);
    const status = await TenantContext.run({ traceId: 'test', tenantId: 't_dev' }, () =>
      svc.getStatus(),
    );
    expect(status.initialized).toBe(true);
    expect(status.adminExists).toBe(true);
    expect(status.roleCount).toBe(3);
    expect(status.demoMode).toBe(env.demoMode);
  });

  it('ensureAdmin 已存在则跳过（幂等）', async () => {
    const userRepo = makeRepo() as any;
    const roleRepo = makeRepo() as any;
    const wordRepo = makeRepo() as any;
    const demoService = makeDemoService();
    userRepo.findOne.mockResolvedValue({ id: 1, username: 'admin' });
    const svc = new SystemService(userRepo, roleRepo, wordRepo, demoService as never);
    const step = await TenantContext.run({ traceId: 'test', tenantId: 't_dev' }, () =>
      svc.initDeploy({}),
    );
    expect(demoService.clearDemoData).toHaveBeenCalled();
    const adminStep = step.steps.find((s) => s.step === 'admin-account');
    expect(adminStep?.status).toBe('skipped');
    expect(userRepo.save).not.toHaveBeenCalled();
  });

  it('ensureAdmin 不存在则创建并哈希密码', async () => {
    const userRepo = makeRepo() as any;
    const roleRepo = makeRepo() as any;
    const wordRepo = makeRepo() as any;
    const demoService = makeDemoService();
    userRepo.findOne.mockResolvedValue(null);
    userRepo.save.mockImplementation(async (u: User) => ({ ...u, id: 5 }));
    const svc = new SystemService(userRepo, roleRepo, wordRepo, demoService as never);
    const step = await TenantContext.run({ traceId: 'test', tenantId: 't_dev' }, () =>
      svc.initDeploy({}),
    );
    expect(demoService.clearDemoData).toHaveBeenCalled();
    const adminStep = step.steps.find((s) => s.step === 'admin-account');
    expect(adminStep?.status).toBe('created');
    expect(userRepo.save.mock.calls[0][0].password).toContain('$2');
  });
});
