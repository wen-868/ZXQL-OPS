import { isIP } from 'net';
import { lookup } from 'dns/promises';

/**
 * 出站 URL 安全守卫（SSRF 防护）。
 *
 * 任何「由服务端代表用户发起请求」的入口（浏览器工作台 navigate、情报采集 target、
 * 素材外链等）都必须先经本守卫校验，避免攻击者借服务端访问内网/元数据服务。
 *
 * 防护分层：
 *  1) 协议白名单：仅 http/https
 *  2) 字面量拦截：localhost / *.local / 常见内网域名
 *  3) IP 字面量拦截：私有段 / 回环 / 链路本地 / 运营商级 NAT / 保留段
 *  4) DNS 解析后拦截（async）：防 DNS rebinding 与域名指向内网
 *  5) 云元数据地址硬拦截（169.254.169.254 等）
 */

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/** 元数据/内网域名后缀（含云厂商元数据服务） */
const BLOCKED_HOST_SUFFIXES = [
  '.local',
  '.localhost',
  '.internal',
  '.intranet',
  '.lan',
  '.home.arpa',
];
const BLOCKED_HOSTS = new Set([
  'localhost',
  'metadata',
  'metadata.google.internal',
  'instance-data',
]);

/** IPv4 私有/保留网段（cidr 形式，按「起始 IP + 掩码位数」判断） */
const BLOCKED_V4_RANGES: Array<[string, number]> = [
  ['0.0.0.0', 8], // 本网络
  ['10.0.0.0', 8], // 私有 A
  ['100.64.0.0', 10], // 运营商级 NAT
  ['127.0.0.0', 8], // 回环
  ['169.254.0.0', 16], // 链路本地（含云元数据 169.254.169.254）
  ['172.16.0.0', 12], // 私有 B
  ['192.0.0.0', 24], // IETF 协议分配
  ['192.0.2.0', 24], // TEST-NET-1
  ['192.88.99.0', 24], // 6to4 中继
  ['192.168.0.0', 16], // 私有 C
  ['198.18.0.0', 15], // 基准测试
  ['198.51.100.0', 24], // TEST-NET-2
  ['203.0.113.0', 24], // TEST-NET-3
  ['224.0.0.0', 4], // 组播
  ['240.0.0.0', 4], // 保留（含 255.255.255.255）
];

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const v = Number(p);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = (n << 8) + v;
  }
  return n >>> 0;
}

/** 判断 IPv4 是否落在被拦截网段 */
function isBlockedV4(ip: string): boolean {
  const val = ipv4ToInt(ip);
  if (val === null) return true; // 非合法 IPv4 一律视为不安全
  for (const [base, bits] of BLOCKED_V4_RANGES) {
    const baseVal = ipv4ToInt(base);
    if (baseVal === null) continue;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    if ((val & mask) === (baseVal & mask)) return true;
  }
  return false;
}

/** IPv4-mapped IPv6（::ffff:a.b.c.d）→ 按 IPv4 规则判定 */
function isBlockedV4Mapped(v: string): boolean | null {
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? isBlockedV4(mapped[1]) : null;
}

/** IPv6：仅放行全局单播（2000::/3），其余（::1 / fc00::/7 / fe80::/10 等）全部拦截 */
function isBlockedV6(ip: string): boolean {
  const v = ip.toLowerCase().split('%')[0];
  // 特殊地址：未指定 / 回环
  if (v === '::1' || v === '::') return true;
  // IPv4-mapped 单独判定
  const mapped = isBlockedV4Mapped(v);
  if (mapped !== null) return mapped;
  // 唯一本地 fc00::/7、链路本地 fe80::/10、组播 ff00::/8
  if (/^f[cd]/.test(v) || /^fe[89ab]/.test(v) || /^ff/.test(v)) return true;
  // 全局单播 2000::/3（2xxx / 3xxx）
  return !/^[23]/.test(v);
}

function isBlockedIp(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isBlockedV4(ip);
  if (family === 6) return isBlockedV6(ip);
  return true;
}

function isBlockedHostname(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, '');
  if (!h) return true;
  if (BLOCKED_HOSTS.has(h)) return true;
  if (BLOCKED_HOST_SUFFIXES.some((s) => h.endsWith(s))) return true;
  // 形如 127.0.0.1.nip.io 的泛解析域名不在此拦截（交由 DNS 解析兜底）
  return false;
}

export interface UrlGuardResult {
  ok: boolean;
  reason?: string;
  /** 归一化后的 URL（校验通过时返回） */
  url?: string;
}

/** 同步校验：协议 + 主机字面量 + IP 字面量（不含 DNS） */
export function checkUrlSync(raw: string): UrlGuardResult {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return { ok: false, reason: 'URL 格式非法' };
  }
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return { ok: false, reason: `不允许的协议: ${parsed.protocol}` };
  }
  const host = parsed.hostname.replace(/^\[|\]$/g, ''); // 去 IPv6 方括号
  if (isBlockedHostname(host)) {
    return { ok: false, reason: `不允许访问的内网主机: ${host}` };
  }
  if (isIP(host) && isBlockedIp(host)) {
    return { ok: false, reason: `不允许访问的内网地址: ${host}` };
  }
  return { ok: true, url: parsed.toString() };
}

/**
 * 完整校验（含 DNS 解析）：防域名指向内网 / DNS rebinding。
 * DNS 解析失败时按「拒绝」处理（fail-closed），避免绕过。
 */
export async function checkUrl(raw: string): Promise<UrlGuardResult> {
  const sync = checkUrlSync(raw);
  if (!sync.ok || !sync.url) return sync;

  const parsed = new URL(sync.url);
  const host = parsed.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host)) return sync; // IP 字面量已在同步阶段判定

  try {
    const records = await lookup(host, { all: true });
    if (!records.length) return { ok: false, reason: `域名解析为空: ${host}` };
    for (const r of records) {
      if (isBlockedIp(r.address)) {
        return { ok: false, reason: `域名解析到内网地址: ${host} → ${r.address}` };
      }
    }
  } catch {
    return { ok: false, reason: `域名解析失败: ${host}` };
  }
  return sync;
}
