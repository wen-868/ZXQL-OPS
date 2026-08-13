// ============ T 选品中心（selectionMaps）============
// 来源 / 人性 中文标签 + 颜色映射
// humanDriver 复用 src/views/analyze/analyzeMaps.ts 的导出（driverLabels/driverColors/driverOptions），勿重复定义
import type { SelectionSource } from '@/api/selection'

// 选品来源
export const selectionSourceMeta: Record<
  SelectionSource,
  { label: string; type: 'success' | 'warning' | 'danger' | 'info' | 'primary'; color: string }
> = {
  manual: { label: '手工', type: 'primary', color: 'var(--app-brand-500)' },
  connected: { label: '对接', type: 'success', color: 'var(--app-success-500)' },
  competitor: { label: '竞品', type: 'warning', color: 'var(--app-warning-500)' },
}

export const selectionSourceOptions: { value: SelectionSource; label: string }[] = [
  { value: 'manual', label: '手工录入' },
  { value: 'connected', label: '平台对接' },
  { value: 'competitor', label: '竞品监控' },
]

// 蓝海词高潜力阈值（score 高于此值标高潜力）
export const blueOceanHighScoreThreshold = 5
