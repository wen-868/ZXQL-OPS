import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthUser } from './auth-user';
import { ROLES_KEY } from './roles.decorator';
import { AppError } from '../shared/app-error';

/** SSO 映射角色 → 运营内置角色（super_admin/ops_admin 视为 admin，ops_viewer 视为 viewer） */
const ROLE_ALIAS: Record<string, string> = {
  super_admin: 'admin',
  ops_admin: 'admin',
  ops_viewer: 'viewer',
};

/**
 * 全局角色守卫：校验登录用户角色是否满足接口 @Roles(...) 要求。
 * 必须在 JwtAuthGuard 之后执行（依赖 req.user）。
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const rawRole = req.user?.role ?? '';
    const role = ROLE_ALIAS[rawRole] || rawRole;
    if (required.includes(role)) return true;

    throw new AppError('FORBIDDEN');
  }
}
