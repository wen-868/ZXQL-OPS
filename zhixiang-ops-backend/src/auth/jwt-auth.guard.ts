import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { verifyToken, AuthUser } from './auth-user';
import { IS_PUBLIC_KEY } from './public.decorator';
import { AppError } from '../shared/app-error';

/**
 * 全局 JWT 鉴权守卫。
 * 所有接口默认需登录，标记 @Public() 的端点豁免。
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // @Public() 标记的接口跳过鉴权
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const auth = req.header('authorization') || '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      throw new AppError('UNAUTHORIZED');
    }
    let user: AuthUser;
    try {
      user = verifyToken(token);
    } catch {
      throw new AppError('UNAUTHORIZED');
    }
    (req as unknown as { user: AuthUser }).user = user;
    return true;
  }
}
