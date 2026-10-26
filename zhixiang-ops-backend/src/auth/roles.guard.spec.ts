import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from './roles.decorator';
import { AuthUser } from './auth-user';

/**
 * RolesGuard 单测。
 * 覆盖：无 required / 空 required 直接放行、SSO 角色别名映射（super_admin/ops_admin→admin、ops_viewer→viewer）、
 * 角色匹配放行、不匹配抛 FORBIDDEN、请求无 user 处理。
 */

const plainHandler = () => undefined;

function makeContext(user?: Partial<AuthUser>): ExecutionContext {
  return {
    getHandler: () => plainHandler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => (user ? { user } : {}) }),
  } as unknown as ExecutionContext;
}

function makeGuard(required: string[] | undefined): RolesGuard {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(required),
  } as unknown as Reflector;
  return new RolesGuard(reflector);
}

describe('RolesGuard', () => {
  it('无 @Roles 元数据 → 直接放行', () => {
    expect(makeGuard(undefined).canActivate(makeContext())).toBe(true);
  });

  it('空 required 数组 → 直接放行', () => {
    expect(makeGuard([]).canActivate(makeContext())).toBe(true);
  });

  it('required 命中用户角色 → 放行', () => {
    expect(makeGuard(['admin']).canActivate(makeContext({ role: 'admin' }))).toBe(true);
  });

  it('SSO 别名 super_admin → admin 命中', () => {
    expect(makeGuard(['admin']).canActivate(makeContext({ role: 'super_admin' }))).toBe(true);
  });

  it('SSO 别名 ops_admin → admin 命中', () => {
    expect(makeGuard(['admin']).canActivate(makeContext({ role: 'ops_admin' }))).toBe(true);
  });

  it('SSO 别名 ops_viewer → viewer 命中', () => {
    expect(makeGuard(['viewer']).canActivate(makeContext({ role: 'ops_viewer' }))).toBe(true);
  });

  it('非别名角色原样使用 → 匹配放行', () => {
    expect(makeGuard(['editor']).canActivate(makeContext({ role: 'editor' }))).toBe(true);
  });

  it('角色不匹配 → 抛 FORBIDDEN', () => {
    expect(() => makeGuard(['admin']).canActivate(makeContext({ role: 'editor' }))).toThrowError(
      expect.objectContaining({ code: 'FORBIDDEN', httpStatus: 403 }),
    );
  });

  it('请求无 user → rawRole 空串，不匹配抛 FORBIDDEN', () => {
    expect(() => makeGuard(['admin']).canActivate(makeContext())).toThrowError(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
  });

  it('metadata 读取使用 [handler, class] 顺序', () => {
    const getAllAndOverride = jest.fn().mockReturnValue(['admin']);
    const guard = new RolesGuard({ getAllAndOverride } as unknown as Reflector);
    guard.canActivate(makeContext({ role: 'admin' }));
    expect(getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [plainHandler, expect.any(Function)]);
  });
});
