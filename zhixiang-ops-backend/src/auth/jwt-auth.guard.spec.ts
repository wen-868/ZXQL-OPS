import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { JwtAuthGuard } from './jwt-auth.guard';
import { IS_PUBLIC_KEY } from './public.decorator';
import { verifyToken, AuthUser } from './auth-user';

/**
 * JwtAuthGuard 单测。
 * 覆盖：@Public() 豁免、无 token 抛 UNAUTHORIZED、token 无效抛 UNAUTHORIZED、
 * token 有效写入 req.user 并放行。
 * verifyToken 通过 jest.mock('../auth/auth-user') 隔离真实 JWT 校验。
 */

jest.mock('../auth/auth-user', () => ({
  verifyToken: jest.fn(),
}));

const mockedVerifyToken = verifyToken as unknown as jest.Mock;

const plainHandler = () => undefined;

function makeRequest(authHeader?: string): Request {
  return {
    header: jest.fn((name: string) => (name === 'authorization' ? authHeader : undefined)),
  } as unknown as Request;
}

function makeContext(authHeader?: string): ExecutionContext {
  return {
    getHandler: () => plainHandler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => makeRequest(authHeader) }),
  } as unknown as ExecutionContext;
}

function makeGuard(isPublic: boolean | undefined): JwtAuthGuard {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(isPublic),
  } as unknown as Reflector;
  return new JwtAuthGuard(reflector);
}

describe('JwtAuthGuard', () => {
  beforeEach(() => {
    mockedVerifyToken.mockReset();
  });

  it('@Public() 豁免 → 直接放行，不解析 token', () => {
    const guard = makeGuard(true);
    const ctx = makeContext('Bearer any.token');
    expect(guard.canActivate(ctx)).toBe(true);
    expect(mockedVerifyToken).not.toHaveBeenCalled();
  });

  it('无 authorization 头 → 抛 UNAUTHORIZED', () => {
    const guard = makeGuard(undefined);
    expect(() => guard.canActivate(makeContext())).toThrowError(
      expect.objectContaining({ code: 'UNAUTHORIZED', httpStatus: 401 }),
    );
  });

  it('Bearer 前缀后无 token → 抛 UNAUTHORIZED', () => {
    const guard = makeGuard(undefined);
    expect(() => guard.canActivate(makeContext('Bearer '))).toThrowError(
      expect.objectContaining({ code: 'UNAUTHORIZED' }),
    );
    expect(mockedVerifyToken).not.toHaveBeenCalled();
  });

  it('token 无效（verifyToken 抛错）→ 抛 UNAUTHORIZED', () => {
    mockedVerifyToken.mockImplementation(() => {
      throw new Error('jwt malformed');
    });
    const guard = makeGuard(undefined);
    expect(() => guard.canActivate(makeContext('Bearer bad.token'))).toThrowError(
      expect.objectContaining({ code: 'UNAUTHORIZED' }),
    );
    expect(mockedVerifyToken).toHaveBeenCalledWith('bad.token');
  });

  it('token 有效 → 写入 req.user 并放行', () => {
    const user: AuthUser = { id: 1, role: 'admin', tenantId: 't1', type: 'standalone' };
    mockedVerifyToken.mockReturnValue(user);
    const guard = makeGuard(undefined);
    const req = makeRequest('Bearer good.token');
    const ctx = {
      getHandler: () => plainHandler,
      getClass: () => class {},
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
    expect(guard.canActivate(ctx)).toBe(true);
    expect((req as unknown as { user: AuthUser }).user).toBe(user);
  });

  it('非 Bearer 前缀原始串直接作为 token 校验', () => {
    mockedVerifyToken.mockReturnValue({ id: 1, role: 'admin', tenantId: 't1', type: 'standalone' });
    const guard = makeGuard(undefined);
    expect(guard.canActivate(makeContext('Basic abc'))).toBe(true);
    expect(mockedVerifyToken).toHaveBeenCalledWith('Basic abc');
  });

  it('metadata 读取使用 IS_PUBLIC_KEY 与 [handler, class]', () => {
    const getAllAndOverride = jest.fn().mockReturnValue(false);
    const guard = new JwtAuthGuard({ getAllAndOverride } as unknown as Reflector);
    guard.canActivate(makeContext('Bearer t'));
    expect(getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
      plainHandler,
      expect.any(Function),
    ]);
  });
});
