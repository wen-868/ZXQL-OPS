// ============ R 商品内容中心（productMaps）============
// 来源 / 平台 / 合规 / 内容状态 中文标签 + 颜色映射
// humanDriver 复用 src/views/analyze/analyzeMaps.ts 的导出（driverLabels/driverColors/driverOptions），勿重复定义
import type { ProductSourceType, ComplianceRisk, ContentStatus, ContentPlatform } from '@/api/products'

// 商品来源
export const sourceTypeMeta: Record<
  ProductSourceType,
  { label: string; type: 'success' | 'warning' | 'danger' | 'info' | 'primary'; color: string }
> = {
  system: { label: '系统', type: 'primary', color: 'var(--app-brand-500)' },
  manual: { label: '手动', type: 'success', color: 'var(--app-success-500)' },
  competitor: { label: '竞品', type: 'warning', color: 'var(--app-warning-500)' },
  t_selection: { label: '选品库', type: 'info', color: 'var(--app-info-500)' },
}

export const sourceTypeOptions: { value: ProductSourceType; label: string }[] = [
  { value: 'system', label: '系统' },
  { value: 'manual', label: '手动' },
  { value: 'competitor', label: '竞品' },
  { value: 't_selection', label: '选品库' },
]

// 内容生成平台
export const platformOptions: { value: ContentPlatform; label: string }[] = [
  { value: 'douyin', label: '抖音' },
  { value: 'wechat', label: '微信' },
  { value: 'xhs', label: '小红书' },
  { value: 'kuaishou', label: '快手' },
]

// 合规风险
export const complianceRiskMeta: Record<
  ComplianceRisk,
  { label: string; type: 'success' | 'warning' | 'danger' | 'info'; color: string }
> = {
  none: { label: '无风险', type: 'success', color: 'var(--app-success-500)' },
  low: { label: '低风险', type: 'warning', color: 'var(--app-warning-500)' },
  high: { label: '高风险', type: 'danger', color: 'var(--app-danger-500)' },
}

export const complianceRiskOptions: { value: ComplianceRisk; label: string }[] = [
  { value: 'none', label: '无风险' },
  { value: 'low', label: '低风险' },
  { value: 'high', label: '高风险' },
]

export const complianceRiskColors: Record<ComplianceRisk, string> = {
  none: 'var(--app-success-500)',
  low: 'var(--app-warning-500)',
  high: 'var(--app-danger-500)',
}

export const complianceRiskLabels: Record<ComplianceRisk, string> = {
  none: '无风险',
  low: '低风险',
  high: '高风险',
}

// 内容状态
export const contentStatusMeta: Record<
  ContentStatus,
  { label: string; type: 'success' | 'warning' | 'danger' | 'info' | 'primary' }
> = {
  draft: { label: '草稿', type: 'info' },
  published: { label: '已发布', type: 'success' },
}

export const contentStatusOptions: { value: ContentStatus; label: string }[] = [
  { value: 'draft', label: '草稿' },
  { value: 'published', label: '已发布' },
]

export const contentStatusLabels: Record<ContentStatus, string> = {
  draft: '草稿',
  published: '已发布',
}
