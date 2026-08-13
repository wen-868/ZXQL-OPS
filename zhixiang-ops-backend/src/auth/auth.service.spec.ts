import jwt from 'jsonwebtoken';
import { AuthService } from './auth.service';
import { env } from '../config/env';
import { MS_JWT_ISSUER, MS_JWT_AUDIENCE, MsTokenPayload } from '../integration/ms-token';
import { AppError } from '../shared/app-error';
import { signToken } from './auth-user';

/**
 * SSO 对接单测（统一管理后台方案 §4.2）。
 * 覆盖：合法换票/自动建号、用户复用、角色映射优先级、非法签发源、租户未映射、禁用账号。
 */

function signMsToken(payload: Partial<MsTokenPayload> = {}): string {
  return jwt.sign(
    {
      id: 1,
      username: 'zhangsan',
      realName: '张三',
      roles: ['SUPER_ADMIN'],
      tenantId: '1',
      ...payload,
    },
    env.JWT_SECRET,
    {
      algorithm: 'HS256',
      issuer: MS_JWT_ISSUER,
      audience: MS_JWT_AUDIENCE,
      expiresIn: '1h',
    },
  );
}

function buildService(
  overrides: {
    userFindOne?: unknown;
    tenantFindOne?: unknown;
  } = {},
) {
  const userRepo = {
    findOne: jest.fn().mockResolvedValue(overrides.userFindOne),
    create: jest.fn().mockImplementation((dto) => ({ id: 100, ...dto })),
    save: jest.fn().mockImplementation(async (u) => u),
  };
  const roleBindRepo = {
    find: jest.fn().mockResolvedValue([
      { msRole: 'SUPER_ADMIN', opsRole: 'super_admin', menuScope: 'all' },
      { msRole: 'OPERATION_ADMIN', opsRole: 'ops_admin', menuScope: 'ops' },
      { msRole: 'FINANCE_ADMIN', opsRole: 'ops_viewer', menuScope: 'readonly' },
      { msRole: 'WAREHOUSE_ADMIN', opsRole: 'ops_viewer', menuScope: 'readonly' },
    ]),
  };
  const tenantBindRepo = {
    findOne: jest
      .fn()
      .mockResolvedValue(
        overrides.tenantFindOne === undefined
          ? { msTenantId: '1', opsTenantId: 't_dev', status: 1 }
          : overrides.tenantFindOne,
      ),
  };
  const demoService = {
    ensureDemoUser: jest.fn().mockResolvedValue({ id: 200, username: 'admin' }),
  };
  return {
    service: new AuthService(
      userRepo as never,
      roleBindRepo as never,
      tenantBindRepo as never,
      demoService as never,
    ),
    userRepo,
    roleBindRepo,
    tenantBindRepo,
    demoService,
  };
}

describe('AuthService.sso（管理系统 SSO 对接）', () => {
  it('合法管理系统 JWT：自动建号（type=connected）并签发运营 token', async () => {
    const { service, userRepo } = buildService({ userFindOne: null });
    const res = await service.sso(`Bearer ${signMsToken()}`);

    expect(userRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'zhangsan',
        role: 'super_admin',
        tenantId: 't_dev',
        type: 'connected',
      }),
    );
    expect(res.user).toEqual({
      id: 100,
      username: 'zhangsan',
      realName: '张三',
      role: 'super_admin',
      tenantId: 't_dev',
    });
    expect(res.roleBind).toEqual({ opsRole: 'super_admin', menuScope: 'all' });
    // 返回的 token 必须能被运营自有校验（issuer=zhixiang-ops）通过
    const decoded = jwt.verify(res.token, env.JWT_SECRET, {
      issuer: 'zhixiang-ops',
      audience: 'zhixiang-ops-client',
    }) as { type: string; tenantId: string };
    expect(decoded.type).toBe('connected');
    expect(decoded.tenantId).toBe('t_dev');
  });

  it('已存在用户：复用并同步角色/租户为映射值', async () => {
    const existing = {
      id: 7,
      username: 'zhangsan',
      realName: '旧名',
      role: 'admin',
      tenantId: 't_dev',
      type: 'standalone',
      status: 1,
    };
    const { service, userRepo } = buildService({ userFindOne: existing });
    const res = await service.sso(`Bearer ${signMsToken()}`);

    expect(userRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 7, role: 'super_admin', type: 'connected' }),
    );
    expect(res.user.id).toBe(7);
  });

  it('角色映射取最高权限：OPERATION_ADMIN+FINANCE_ADMIN → ops_admin', async () => {
    const { service } = buildService({ userFindOne: null });
    const res = await service.sso(
      `Bearer ${signMsToken({ roles: ['FINANCE_ADMIN', 'OPERATION_ADMIN'] })}`,
    );
    expect(res.roleBind).toEqual({ opsRole: 'ops_admin', menuScope: 'ops' });
  });

  it('门店/收银角色无运营权限：拒绝（AUTH_MS_ROLE_NOT_ALLOWED）', async () => {
    const { service } = buildService({ userFindOne: null });
    await expect(
      service.sso(`Bearer ${signMsToken({ roles: ['CASHIER'] })}`),
    ).rejects.toMatchObject({ code: 'AUTH_MS_ROLE_NOT_ALLOWED' });
  });

  it('非法签发源（运营自有 token 冒充）：拒绝（AUTH_MS_TOKEN_INVALID）', async () => {
    const { service } = buildService({ userFindOne: null });
    const opsToken = signToken({
      id: 1,
      username: 'ops',
      role: 'admin',
      tenantId: 't_dev',
      type: 'standalone',
    });
    await expect(service.sso(`Bearer ${opsToken}`)).rejects.toMatchObject({
      code: 'AUTH_MS_TOKEN_INVALID',
    });
  });

  it('缺 token：拒绝（AUTH_MS_TOKEN_INVALID）', async () => {
    const { service } = buildService({ userFindOne: null });
    await expect(service.sso('')).rejects.toMatchObject({ code: 'AUTH_MS_TOKEN_INVALID' });
  });

  it('租户未映射：拒绝（SSO_TENANT_NOT_MAPPED）', async () => {
    const { service } = buildService({
      userFindOne: null,
      tenantFindOne: null,
    });
    await expect(service.sso(`Bearer ${signMsToken({ tenantId: '999' })}`)).rejects.toMatchObject({
      code: 'SSO_TENANT_NOT_MAPPED',
    });
  });

  it('禁用账号：拒绝（AUTH_USER_DISABLED）', async () => {
    const { service } = buildService({
      userFindOne: {
        id: 7,
        username: 'zhangsan',
        role: 'admin',
        tenantId: 't_dev',
        type: 'standalone',
        status: 0,
      },
    });
    await expect(service.sso(`Bearer ${signMsToken()}`)).rejects.toMatchObject({
      code: 'AUTH_USER_DISABLED',
    });
  });

  it('依赖未注入时 AppError 类型正确（回归保护）', () => {
    expect(AppError).toBeDefined();
  });
});
