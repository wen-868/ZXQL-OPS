/**
 * 账号矩阵枚举与校验（规划 §4-B / 开发顺序设计.md 的 B-core）。
 * 平台 / 身份 / 阶段 / 健康状态的取值集合与类型守卫，供实体与 DTO 共用。
 */

export type Platform =
  | 'douyin' // 抖音
  | 'kuaishou' // 快手
  | 'xiaohongshu' // 小红书
  | 'bilibili' // B站
  | 'wechat-channels'; // 视频号

export const PLATFORMS: Platform[] = [
  'douyin',
  'kuaishou',
  'xiaohongshu',
  'bilibili',
  'wechat-channels',
];

/** 身份：主号 / 小号 / 矩阵号 */
export type AccountIdentity = 'primary' | 'secondary' | 'matrix';
export const ACCOUNT_IDENTITIES: AccountIdentity[] = ['primary', 'secondary', 'matrix'];

/** 阶段：养号 / 成长 / 成熟 / 衰退 */
export type AccountStage = 'nurturing' | 'growing' | 'mature' | 'declining';
export const ACCOUNT_STAGES: AccountStage[] = ['nurturing', 'growing', 'mature', 'declining'];

/**
 * 健康状态：
 * - normal   正常
 * - warning  临近掉签/轻度限流（需关注）
 * - risk     高风险（重度限流/降权/即将掉签）
 * - unsigned 未授权（Token 缺失或已过期）
 * - banned   封禁
 */
export type AccountStatus = 'normal' | 'warning' | 'risk' | 'unsigned' | 'banned';
export const ACCOUNT_STATUSES: AccountStatus[] = [
  'normal',
  'warning',
  'risk',
  'unsigned',
  'banned',
];

/** 账号健康事件类型（掉签/限流/降权/恢复/封禁/重新授权/直播活跃回写） */
export type AccountHealthEventType =
  | 'token_expired' // 定时巡检发现 Token 过期 → unsigned
  | 'token_refreshed' // 主动续期成功
  | 'rate_limited' // 平台限流
  | 'demoted' // 降权
  | 'recovered' // 恢复
  | 'banned' // 封禁
  | 'connected' // 首次绑定 Token
  | 'live_ended'; // K 直播结束 → 活跃回写（不改变账号状态）

export function isPlatform(v: unknown): v is Platform {
  return typeof v === 'string' && (PLATFORMS as string[]).includes(v);
}
export function isAccountIdentity(v: unknown): v is AccountIdentity {
  return typeof v === 'string' && (ACCOUNT_IDENTITIES as string[]).includes(v);
}
export function isAccountStage(v: unknown): v is AccountStage {
  return typeof v === 'string' && (ACCOUNT_STAGES as string[]).includes(v);
}
export function isAccountStatus(v: unknown): v is AccountStatus {
  return typeof v === 'string' && (ACCOUNT_STATUSES as string[]).includes(v);
}
