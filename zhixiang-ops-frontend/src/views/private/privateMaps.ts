// ============ U 私域中心（privateMaps）============
// 粉丝来源 / 私域群类型 中文标签 + 颜色映射集中于此
// 组件内不散落硬编码色值，统一从此处取。
import type { FansSource, PrivateGroupType } from '@/api/private'

// 粉丝来源
export const fansSourceMeta: Record<
  FansSource,
  { label: string; color: string }
> = {
  aggregate: { label: '聚合', color: 'var(--app-brand-500)' },
  authorized: { label: '授权', color: 'var(--app-success-500)' },
  public: { label: '公开', color: 'var(--app-cat-ink)' },
}

export const fansSourceOptions: { value: FansSource; label: string }[] = [
  { value: 'aggregate', label: '聚合' },
  { value: 'authorized', label: '授权' },
  { value: 'public', label: '公开' },
]

// 平台维度（用于 listFans 的 platform 查询参数；后端 platform 为任意 string，这里取行业主流三平台）
export const fansPlatformOptions: { value: string; label: string }[] = [
  { value: 'douyin', label: '抖音' },
  { value: 'wechat', label: '微信' },
  { value: 'kuaishou', label: '快手' },
]

export const fansSourceColors: Record<FansSource, string> = {
  aggregate: 'var(--app-brand-500)',
  authorized: 'var(--app-success-500)',
  public: 'var(--app-cat-ink)',
}

// 私域群类型
export const privateGroupTypeMeta: Record<
  PrivateGroupType,
  { label: string; color: string }
> = {
  wecom: { label: '企微', color: 'var(--app-brand-500)' },
  wechat: { label: '微信', color: 'var(--app-cat-green)' },
}

export const privateGroupTypeOptions: { value: PrivateGroupType; label: string }[] = [
  { value: 'wecom', label: '企微' },
  { value: 'wechat', label: '微信' },
]

export const privateGroupTypeColors: Record<PrivateGroupType, string> = {
  wecom: 'var(--app-brand-500)',
  wechat: 'var(--app-cat-green)',
}
