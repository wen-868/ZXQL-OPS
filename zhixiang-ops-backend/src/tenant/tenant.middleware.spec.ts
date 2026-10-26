import { NextFunction, Request, Response } from 'express';
import { TenantMiddleware } from './tenant.middleware';
import { TenantContext, TenantContextData } from './tenant-context';
import { verifyToken } from '../auth/auth-user';

/**
 * TenantMiddleware 单测。
 * 覆盖：traceId 生成（x-trace-id 覆盖 / uuid 兜底）、租户头解析（tenantId / x-tenant-id）、
 * Bearer token 解析成功（覆盖/回退租户）、非法 token 走 catch、next 始终调用。
 * verifyToken 通过 jest.mock('../auth/auth-user') 隔离真实 JWT 校验。
 */

jest.mock('../auth/auth-user', () => ({
  verifyToken: jest.fn(),
}));

const mockedVerifyToken = verifyToken as unknown as jest.Mock;

function makeReq(headers: Record<string, string | undefined>): Request {
  return {
    header: jest.fn((name: string) => headers[name]),
  } as unknown as Request;
}

function run(headers: Record<string, string | undefined>): {
  ctx: TenantContextData | undefined;
  next: jest.Mock;
} {
  const next = jest.fn();
  const middleware = new TenantMiddleware();
  let captured: TenantContextData | undefined;
  const runSpy = jest.spyOn(TenantContext, 'run').mockImplementation((data, cb) => {
    captured = data;
    return cb();
  });
  middleware.use(makeReq(headers), {} as Response, next as NextFunction);
  runSpy.mockRestore();
  return { ctx: captured, next };
}

describe('TenantMiddleware', () => {
  beforeEach(() => {
    mockedVerifyToken.mockReset();
  });

  it('无任何头：traceId 生成 uuid、tenantId undefined、type standalone、next 调用', () => {
    const { ctx, next } = run({});
    expect(ctx).toBeDefined();
    expect(ctx!.traceId).toEqual(expect.any(String));
    expect(ctx!.traceId.length).toBeGreaterThan(0);
    expect(ctx!.tenantId).toBeUndefined();
    expect(ctx!.type).toBe('standalone');
    expect(next).toHaveBeenCalledTimes(1);
    expect(mockedVerifyToken).not.toHaveBeenCalled();
  });

  it('x-trace-id 存在：traceId 使用请求头值', () => {
    const { ctx } = run({ 'x-trace-id': 'trace-abc' });
    expect(ctx!.traceId).toBe('trace-abc');
  });

  it('tenantId 请求头：作为租户上下文', () => {
    const { ctx } = run({ tenantId: 't1' });
    expect(ctx!.tenantId).toBe('t1');
  });

  it('tenantId 缺失时回退 x-tenant-id', () => {
    const { ctx } = run({ 'x-tenant-id': 'xt1' });
    expect(ctx!.tenantId).toBe('xt1');
  });

  it('Bearer token 有效：解析并覆盖租户与用户信息', () => {
    mockedVerifyToken.mockReturnValue({
      id: 7,
      role: 'admin',
      type: 'standalone',
      tenantId: 't_jwt',
    });
    const { ctx } = run({ authorization: 'Bearer abc.def.ghi', tenantId: 't_header' });
    expect(mockedVerifyToken).toHaveBeenCalledWith('abc.def.ghi');
    expect(ctx!.tenantId).toBe('t_jwt');
    expect(ctx!.userId).toBe(7);
    expect(ctx!.role).toBe('admin');
    expect(ctx!.type).toBe('standalone');
    expect(ctx!.authToken).toBe('abc.def.ghi');
  });

  it('Bearer token 有效但无 tenantId：回退请求头租户', () => {
    mockedVerifyToken.mockReturnValue({ id: 2, role: 'viewer', type: 'standalone' });
    const { ctx } = run({ authorization: 'Bearer tok', 'x-tenant-id': 't_fallback' });
    expect(ctx!.tenantId).toBe('t_fallback');
    expect(ctx!.role).toBe('viewer');
  });

  it('非法 token：verifyToken 抛错进 catch，租户保留请求头值，next 仍调用', () => {
    mockedVerifyToken.mockImplementation(() => {
      throw new Error('jwt expired');
    });
    const { ctx, next } = run({ authorization: 'Bearer bad.token', tenantId: 't1' });
    expect(ctx!.tenantId).toBe('t1');
    expect(ctx!.userId).toBeUndefined();
    expect(ctx!.authToken).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('非 Bearer 前缀的 authorization：raw 字符串仍作为 token 解析', () => {
    mockedVerifyToken.mockReturnValue({ id: 1, role: 'admin', type: 'standalone' });
    const { ctx } = run({ authorization: 'Basic abc' });
    expect(mockedVerifyToken).toHaveBeenCalledWith('Basic abc');
    expect(ctx!.userId).toBe(1);
  });

  it('仅 Bearer 前缀无内容：token 为空不解析', () => {
    const { ctx } = run({ authorization: 'Bearer ' });
    expect(mockedVerifyToken).not.toHaveBeenCalled();
    expect(ctx!.tenantId).toBeUndefined();
  });
});
