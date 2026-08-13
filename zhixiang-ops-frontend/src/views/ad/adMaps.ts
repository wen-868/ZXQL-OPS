// ============ S 投流中心（adMaps）============
// 平台 / 账户类型 / 账户状态 / 计划类型 / 计划状态 中文标签 + 颜色映射集中于此
// 组件内不散落硬编码色值，统一从此处取。
import type {
  AdPlatform,
  AdAccountType,
  AdAccountStatus,
  AdPlanType,
  AdCampaignStatus,
} from '@/api/ad'

// 投放平台
export const adPlatformMeta: Record<
  AdPlatform,
  { label: string; color: string }
> = {
  douyin: { label: '抖音', color: 'var(--app-danger-500)' },
  wechat: { label: '微信', color: 'var(--app-cat-green)' },
  kuaishou: { label: '快手', color: '#ff5000' },
}

export const adPlatformOptions: { value: AdPlatform; label: string }[] = [
  { value: 'douyin', label: '抖音' },
  { value: 'wechat', label: '微信' },
  { value: 'kuaishou', label: '快手' },
]

export const adPlatformColors: Record<AdPlatform, string> = {
  douyin: 'var(--app-danger-500)',
  wechat: 'var(--app-cat-green)',
  kuaishou: '#ff5000',
}

// 投放账户类型
export const adAccountTypeMeta: Record<
  AdAccountType,
  { label: string; color: string }
> = {
  qianchuan: { label: '千川', color: 'var(--app-danger-500)' },
  adq: { label: 'ADQ', color: 'var(--app-brand-500)' },
  xiaodian_tong: { label: '小店通', color: 'var(--app-cat-orange)' },
}

export const adAccountTypeOptions: { value: AdAccountType; label: string }[] = [
  { value: 'qianchuan', label: '千川' },
  { value: 'adq', label: 'ADQ' },
  { value: 'xiaodian_tong', label: '小店通' },
]

export const adAccountTypeColors: Record<AdAccountType, string> = {
  qianchuan: 'var(--app-danger-500)',
  adq: 'var(--app-brand-500)',
  xiaodian_tong: 'var(--app-cat-orange)',
}

// 投放账户状态（el-tag type）
export const adAccountStatusMeta: Record<
  AdAccountStatus,
  { label: string; type: 'success' | 'info' | 'danger'; color: string }
> = {
  active: { label: '正常', type: 'success', color: 'var(--app-success-500)' },
  expired: { label: '已过期', type: 'info', color: 'var(--app-cat-ink)' },
  banned: { label: '封禁', type: 'danger', color: 'var(--app-danger-500)' },
}

export const adAccountStatusOptions: { value: AdAccountStatus; label: string }[] = [
  { value: 'active', label: '正常' },
  { value: 'expired', label: '已过期' },
  { value: 'banned', label: '封禁' },
]

export const adAccountStatusColors: Record<AdAccountStatus, string> = {
  active: 'var(--app-success-500)',
  expired: 'var(--app-cat-ink)',
  banned: 'var(--app-danger-500)',
}

export const adAccountStatusLabels: Record<AdAccountStatus, string> = {
  active: '正常',
  expired: '已过期',
  banned: '封禁',
}

// 投放计划类型
export const adPlanTypeMeta: Record<
  AdPlanType,
  { label: string; color: string }
> = {
  standard: { label: '标准', color: 'var(--app-brand-500)' },
  full_domain: { label: '全域', color: 'var(--app-cat-purple)' },
  crowd: { label: '人群', color: 'var(--app-cat-cyan)' },
  bid: { label: '出价', color: 'var(--app-cat-orange)' },
}

export const adPlanTypeOptions: { value: AdPlanType; label: string }[] = [
  { value: 'standard', label: '标准' },
  { value: 'full_domain', label: '全域' },
  { value: 'crowd', label: '人群' },
  { value: 'bid', label: '出价' },
]

export const adPlanTypeColors: Record<AdPlanType, string> = {
  standard: 'var(--app-brand-500)',
  full_domain: 'var(--app-cat-purple)',
  crowd: 'var(--app-cat-cyan)',
  bid: 'var(--app-cat-orange)',
}

// 投放计划状态（el-tag type）
export const adCampaignStatusMeta: Record<
  AdCampaignStatus,
  { label: string; type: 'info' | 'success' | 'warning' | 'danger'; color: string }
> = {
  draft: { label: '草稿', type: 'info', color: 'var(--app-cat-ink)' },
  running: { label: '投放中', type: 'success', color: 'var(--app-success-500)' },
  paused: { label: '已暂停', type: 'warning', color: 'var(--app-warning-500)' },
  ended: { label: '已结束', type: 'danger', color: 'var(--app-danger-500)' },
}

export const adCampaignStatusOptions: { value: AdCampaignStatus; label: string }[] = [
  { value: 'draft', label: '草稿' },
  { value: 'running', label: '投放中' },
  { value: 'paused', label: '已暂停' },
  { value: 'ended', label: '已结束' },
]

export const adCampaignStatusColors: Record<AdCampaignStatus, string> = {
  draft: 'var(--app-cat-ink)',
  running: 'var(--app-success-500)',
  paused: 'var(--app-warning-500)',
  ended: 'var(--app-danger-500)',
}

export const adCampaignStatusLabels: Record<AdCampaignStatus, string> = {
  draft: '草稿',
  running: '投放中',
  paused: '已暂停',
  ended: '已结束',
}
