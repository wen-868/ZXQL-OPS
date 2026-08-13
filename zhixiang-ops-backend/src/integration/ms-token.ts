import jwt from 'jsonwebtoken';
import { env } from '../config/env';

/**
 * 管理系统 JWT 校验（对接方案 §4.1 / §4.2 / §18）。
 * 管理系统 JWT：HS256，issuer=zhixiang-system，audience=zhixiang-client，有效期 4h。
 * 运营侧使用与管理系统相同的 JWT_SECRET 本地验签（无需联网）。
 */

export const MS_JWT_ISSUER = 'zhixiang-system';
export const MS_JWT_AUDIENCE = 'zhixiang-client';

/** 管理系统 JWT 载荷（对齐 backend/src/middleware/auth.ts 的 AuthUser） */
export interface MsTokenPayload {
  id: number;
  username: string;
  realName?: string;
  roles: string[];
  storeId?: number | null;
  tenantId: string;
}

/**
 * 校验管理系统 JWT：仅接受 zhixiang-system 签发的 token。
 * 校验失败统一抛 401（由调用方转 AUTH_MS_TOKEN_INVALID）。
 */
export function verifyMsToken(token: string): MsTokenPayload {
  return jwt.verify(token, env.JWT_SECRET, {
    algorithms: ['HS256'],
    issuer: MS_JWT_ISSUER,
    audience: MS_JWT_AUDIENCE,
  }) as MsTokenPayload;
}
