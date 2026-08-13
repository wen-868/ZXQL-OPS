/**
 * 租户中间件
 * 从 JWT 中提取 tenantId，挂载到 req 上
 * 所有需要租户隔离的路由都必须经过此中间件
 */

import type { Request, Response, NextFunction } from "express";
import type { AuthUser } from "./auth";

import { fail } from "../shared/response";
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      tenantId?: string;
    }
  }
}

export interface TenantRequest extends Request {
  tenantId: string;
}

export function tenantMiddleware(req: TenantRequest, res: Response, next: NextFunction) {
  const tenantId = req.user?.tenantId;
  if (!tenantId) {
    return res.status(403).json(fail('缺少租户信息', '403'));
  }
  req.tenantId = tenantId;
  next();
}

/**
 * 获取当前租户ID
 * @param req - 请求对象
 * @returns 租户ID
 */
export function getTenantId(req: Request): string {
  const tenantId = (req as TenantRequest).tenantId;
  if (!tenantId) {
    throw new Error('获取租户ID失败：请求对象中缺少tenantId，请确保已通过tenantMiddleware中间件');
  }
  return tenantId;
}

/**
 * 设置租户ID到请求对象
 * @param req - 请求对象
 * @param tenantId - 租户ID
 */
export function setTenantId(req: Request, tenantId: string): void {
  (req as TenantRequest).tenantId = tenantId;
}