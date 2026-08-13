import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { verifyToken } from '../auth/auth-user';
import { TenantContext, TenantContextData } from './tenant-context';

/**
 * 租户中间件（对齐管理系统 ai-base 的 tenant.middleware）。
 * 每次请求生成唯一 traceId，并解析租户身份：
 *  优先级：Authorization Bearer → 解析出 tenantId/userId/role/type；
 *          否则回退请求头 tenantId / x-tenant-id。
 * 非法 token 不阻断请求，受保护接口交由 JwtAuthGuard 校验。
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const traceId = req.header('x-trace-id') || uuid();
    const headerTenant = req.header('tenantId') || req.header('x-tenant-id') || undefined;

    const ctx: TenantContextData = { traceId, tenantId: headerTenant, type: 'standalone' };

    const auth = req.header('authorization') || '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    if (token) {
      try {
        const user = verifyToken(token);
        ctx.tenantId = user.tenantId || headerTenant;
        ctx.userId = user.id;
        ctx.role = user.role;
        ctx.type = user.type;
        ctx.authToken = token;
      } catch {
        // 交由 JwtAuthGuard 处理鉴权失败
      }
    }

    TenantContext.run(ctx, () => next());
  }
}
