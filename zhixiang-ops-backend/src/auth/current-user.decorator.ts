import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AuthUser } from './auth-user';

/** 从请求中取出已认证的 AuthUser（由 TenantMiddleware / JwtAuthGuard 写入）。 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return (req as unknown as { user: AuthUser }).user;
  },
);
