import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CsrfGuard } from './csrf.guard';
import { CsrfExempt } from './csrf-exempt.decorator';
import { issueCsrfToken } from './csrf';

/** 全局 CSRF 守卫单测（商业级清单 C2）：方法白名单、豁免、令牌校验。 */

const plainHandler = () => undefined;

function makeContext(
  method: string,
  headers: Record<string, unknown>,
  cls: unknown = class {},
): ExecutionContext {
  return {
    getHandler: () => plainHandler,
    getClass: () => cls,
    switchToHttp: () => ({ getRequest: () => ({ method, headers }) }),
  } as unknown as ExecutionContext;
}

/** 带 @CsrfExempt 元数据的控制器（类级豁免） */
@CsrfExempt()
class ExemptController {}

describe('CsrfGuard', () => {
  let guard: CsrfGuard;

  beforeEach(() => {
    guard = new CsrfGuard(new Reflector());
  });

  it('GET/HEAD/OPTIONS 直接放行（不校验令牌）', () => {
    for (const m of ['GET', 'HEAD', 'OPTIONS']) {
      expect(guard.canActivate(makeContext(m, {}))).toBe(true);
    }
  });

  it('写请求携带合法令牌放行', () => {
    const token = issueCsrfToken(1, 't_dev');
    expect(guard.canActivate(makeContext('POST', { 'x-csrf-token': token }))).toBe(true);
  });

  it('写请求缺令牌拒绝（CSRF_INVALID）', () => {
    expect(() => guard.canActivate(makeContext('POST', {}))).toThrowError(
      expect.objectContaining({ code: 'CSRF_INVALID', httpStatus: 403 }),
    );
  });

  it('写请求令牌非法拒绝', () => {
    expect(() =>
      guard.canActivate(makeContext('POST', { 'x-csrf-token': 'forged.token' })),
    ).toThrowError(expect.objectContaining({ code: 'CSRF_INVALID' }));
  });

  it('PUT/DELETE 同样校验', () => {
    expect(() => guard.canActivate(makeContext('PUT', {}))).toThrowError(
      expect.objectContaining({ code: 'CSRF_INVALID' }),
    );
    expect(() => guard.canActivate(makeContext('DELETE', {}))).toThrowError(
      expect.objectContaining({ code: 'CSRF_INVALID' }),
    );
  });

  it('@CsrfExempt 标记的端点写请求豁免', () => {
    expect(guard.canActivate(makeContext('POST', {}, ExemptController))).toBe(true);
  });
});
