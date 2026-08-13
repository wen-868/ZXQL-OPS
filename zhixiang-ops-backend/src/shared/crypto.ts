import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { env } from '../config/env';

/**
 * 敏感字段 AES-256-CBC 加解密。
 * 密钥由各用途专用变量经 SHA-256 派生为 32 字节；密文格式：`<ivHex>:<cipherHex>`（随机 IV 前置）。
 */
const ALGO = 'aes-256-cbc';

function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

// —— 平台 Token 加密（基于 OPS_TOKEN_SECRET，缺省复用 JWT_SECRET）——
export function encryptSecret(data: string): string {
  const key = deriveKey(env.OPS_TOKEN_SECRET || env.JWT_SECRET);
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${enc.toString('hex')}`;
}

export function decryptSecret(text: string): string {
  const key = deriveKey(env.OPS_TOKEN_SECRET || env.JWT_SECRET);
  const [ivHex, dataHex] = text.split(':');
  if (!ivHex || !dataHex) throw new Error('密文格式非法');
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'));
  const dec = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return dec.toString('utf8');
}

// —— 订单收货信息 JSON 加密（基于 OPS_DATA_SECRET，合规边界 §11②）——
export function encryptJSON(data: unknown): string {
  const key = deriveKey(env.OPS_DATA_SECRET || env.JWT_SECRET);
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGO, key, iv);
  const json = JSON.stringify(data);
  const enc = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${enc.toString('hex')}`;
}

export function decryptJSON<T = Record<string, unknown>>(text: string): T {
  const key = deriveKey(env.OPS_DATA_SECRET || env.JWT_SECRET);
  const [ivHex, dataHex] = text.split(':');
  if (!ivHex || !dataHex) throw new Error('密文格式非法');
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'));
  const dec = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return JSON.parse(dec.toString('utf8')) as T;
}
