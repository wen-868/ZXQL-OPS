import * as jwt from 'jsonwebtoken';
import { verifyMsToken, MS_JWT_ISSUER, MS_JWT_AUDIENCE } from './ms-token';
import { env } from '../config/env';

/**
 * 管理系统 SSO token 验签测试。
 * 密钥取 OPS_MS_JWT_SECRET（缺省回退 JWT_SECRET）；独立配置后与本地密钥解耦。
 */
describe('ms-token', () => {
  const payload = {
    id: 1,
    username: 'ms-admin',
    roles: ['super_admin'],
    tenantId: 't-ms-1',
  };

  const sign = (secret: string, overrides: Record<string, unknown> = {}) =>
    jwt.sign({ ...payload, ...overrides }, secret, {
      issuer: MS_JWT_ISSUER,
      audience: MS_JWT_AUDIENCE,
      algorithm: 'HS256',
      expiresIn: '1h',
    });

  afterEach(() => {
    // 恢复缺省（回退 JWT_SECRET）
    (env as { OPS_MS_JWT_SECRET: string }).OPS_MS_JWT_SECRET = env.JWT_SECRET;
  });

  it('默认（回退 JWT_SECRET）：合法 token 验签通过', () => {
    (env as { OPS_MS_JWT_SECRET: string }).OPS_MS_JWT_SECRET = env.JWT_SECRET;
    const decoded = verifyMsToken(sign(env.JWT_SECRET));
    expect(decoded.username).toBe('ms-admin');
    expect(decoded.tenantId).toBe('t-ms-1');
  });

  it('独立 OPS_MS_JWT_SECRET：用该密钥签发的 token 验签通过', () => {
    const msSecret = 'ms-only-secret-key-for-sso-verification-0123456789';
    (env as { OPS_MS_JWT_SECRET: string }).OPS_MS_JWT_SECRET = msSecret;
    const decoded = verifyMsToken(sign(msSecret));
    expect(decoded.id).toBe(1);
  });

  it('独立密钥已配置时，本地 JWT_SECRET 签发的 token 被拒绝（密钥解耦）', () => {
    const msSecret = 'ms-only-secret-key-for-sso-verification-0123456789';
    (env as { OPS_MS_JWT_SECRET: string }).OPS_MS_JWT_SECRET = msSecret;
    expect(() => verifyMsToken(sign(env.JWT_SECRET))).toThrow();
  });

  it('issuer/audience 不符的 token 拒绝', () => {
    const bad = jwt.sign(payload, env.JWT_SECRET, {
      issuer: 'other-system',
      audience: MS_JWT_AUDIENCE,
      expiresIn: '1h',
    });
    expect(() => verifyMsToken(bad)).toThrow();
  });

  it('篡改 payload 的 token 拒绝（签名不匹配）', () => {
    const token = sign(env.JWT_SECRET);
    const [, body, sig] = token.split('.');
    // 篡改用户名为 admin（伪造提权）
    const forged = Buffer.from(
      JSON.stringify({ ...payload, roles: ['super_admin', 'root'] }),
    ).toString('base64url');
    expect(() =>
      verifyMsToken(`${forged}.${body}.${sig}`.replace(`${body}`, `${forged}`)),
    ).toThrow();
  });
});
