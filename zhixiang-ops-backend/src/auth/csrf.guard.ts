import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppError } from '../shared/app-error';
import { CSRF_EXEMPT_KEY } from './csrf-exempt.decorator';
import { verifyCsrfToken } from './csrf';

/**
 * 全局 CSRF 守卫（商业级清单 C2，防御纵深）。
 * - 仅拦截写请求（POST/PUT/PATCH/DELETE）；GET/HEAD/OPTIONS 直接放行。
 * - @CsrfExempt() 标记的端点（预认证登录四端点、自带 HMAC 签名的回调）豁免。
 * - 校验 x-csrf-token：无状态 HMAC 验签 + 过期校验，失败返回 403 CSRF_INVALID。
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private static readonly SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<{ method: string; headers: Record<string, unknown> }>();
    if (CsrfGuard.SAFE_METHODS.has(req.method)) return true;

    const exempt = this.reflector.getAllAndOverride<boolean>(CSRF_EXEMPT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (exempt) return true;

    const token = req.headers['x-csrf-token'];
    if (typeof token !== 'string' || !verifyCsrfToken(token)) {
      throw new AppError('CSRF_INVALID');
    }
    return true;
  }
}
