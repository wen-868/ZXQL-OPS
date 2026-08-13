import jwt from 'jsonwebtoken';
import { env } from '../config/env';

/**
 * 鉴权用户模型与 JWT 工具（对齐管理系统 auth 的 AuthUser 结构）。
 * 注：运营系统第一版为 standalone，但 AuthUser.type 预留 connected（SSO）分支。
 */

export type UserType = 'admin' | 'saas' | 'merchant' | 'platform' | 'standalone' | 'connected';

export interface AuthUser {
  id: number;
  username?: string;
  realName?: string;
  role: string;
  tenantId: string;
  type: UserType;
  iat?: number;
  exp?: number;
}

const ISSUER = 'zhixiang-ops';
const AUDIENCE = 'zhixiang-ops-client';

export function signToken(
  payload: Omit<AuthUser, 'iat' | 'exp'>,
  expiresIn: number | string = '7d',
): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): AuthUser {
  return jwt.verify(token, env.JWT_SECRET, {
    issuer: ISSUER,
    audience: AUDIENCE,
  }) as AuthUser;
}
