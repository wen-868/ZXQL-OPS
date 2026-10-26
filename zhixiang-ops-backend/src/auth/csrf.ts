import { createHmac, timingSafeEqual } from 'crypto';
import { env } from '../config/env';

/**
 * 无状态 CSRF 令牌（商业级清单 C2）。
 * 结构：base64url({u,tenantId,exp}) + "." + HMAC-SHA256(body, CSRF_SECRET)
 * - 登录/注册/SSO/演示登录响应下发；前端随请求头 x-csrf-token 带回。
 * - 无服务端会话存储，验签即验真；exp 过期即失效。
 */

export interface CsrfPayload {
  u: number;
  tenantId?: string;
  exp: number;
}

/** 与登录态同量级的令牌有效期（默认 12h） */
const CSRF_TTL_MS = 12 * 60 * 60 * 1000;

function b64urlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from((s + pad).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function hmac(body: string): string {
  return createHmac('sha256', env.CSRF_SECRET).update(body).digest('base64url');
}

/** 为已认证用户签发 CSRF 令牌 */
export function issueCsrfToken(userId: number, tenantId?: string): string {
  const payload: CsrfPayload = { u: userId, tenantId, exp: Date.now() + CSRF_TTL_MS };
  const body = b64urlEncode(Buffer.from(JSON.stringify(payload)));
  return `${body}.${hmac(body)}`;
}

/** 形态预检：必须是非空且长度合理（≤512）的字符串，避免对超长输入做无谓的 HMAC 计算 */
function isPlausibleToken(token: string): boolean {
  return typeof token === 'string' && token.length > 0 && token.length <= 512;
}

/** 常量时间比对签名（长度不等时 timingSafeEqual 会抛错，故先比长度短路） */
function signatureMatches(body: string, sig: string): boolean {
  const expectedBuf = Buffer.from(hmac(body), 'utf8');
  const sigBuf = Buffer.from(sig, 'utf8');
  return expectedBuf.length === sigBuf.length && timingSafeEqual(expectedBuf, sigBuf);
}

/** 解析载荷并判定未过期（载荷被篡改导致 JSON 解析失败时按无效处理） */
function isFresh(body: string): boolean {
  try {
    const payload = JSON.parse(b64urlDecode(body).toString('utf8')) as CsrfPayload;
    return typeof payload.exp === 'number' && payload.exp >= Date.now();
  } catch {
    return false;
  }
}

/** 校验 CSRF 令牌：签名一致且未过期 */
export function verifyCsrfToken(token: string): boolean {
  if (!isPlausibleToken(token)) return false;
  const dot = token.indexOf('.');
  if (dot <= 0) return false;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  return signatureMatches(body, sig) && isFresh(body);
}
