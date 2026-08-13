// ============ J 数据监控与回收（recycleMaps）============
// 范围 / 状态 / 再分析 / 五维指标 中文标签 + 颜色映射
// 类型与后端 recycle.types.ts / entity 对齐

// 回收范围
export type RecycleScope = 'video' | 'account' | 'all'

export const recycleScopeMeta: Record<
  RecycleScope,
  { label: string; type: 'success' | 'warning' | 'danger' | 'info' | 'primary'; color: string }
> = {
  video: { label: '单视频', type: 'primary', color: 'var(--app-brand-500)' },
  account: { label: '账号', type: 'warning', color: 'var(--app-warning-500)' },
  all: { label: '全量', type: 'success', color: 'var(--app-success-500)' },
}

export const recycleScopeOptions: { value: RecycleScope; label: string }[] = [
  { value: 'video', label: '单视频（填 I 发布任务 id）' },
  { value: 'account', label: '账号（填账号 id）' },
  { value: 'all', label: '全量（填 all）' },
]

// 回收任务状态 / 再分析状态（复用同一色板）
export type RecycleStatus = 'pending' | 'running' | 'done' | 'failed'

export const recycleStatusMeta: Record<
  RecycleStatus,
  { label: string; type: 'success' | 'warning' | 'danger' | 'info' | 'primary'; color: string }
> = {
  pending: { label: '待执行', type: 'info', color: 'var(--app-neutral-400)' },
  running: { label: '执行中', type: 'primary', color: 'var(--app-brand-500)' },
  done: { label: '完成', type: 'success', color: 'var(--app-success-500)' },
  failed: { label: '失败', type: 'danger', color: 'var(--app-danger-500)' },
}

// 再分析状态（复用 RecycleStatus 色板）
export type ReanalysisStatus = 'pending' | 'running' | 'done' | 'failed'

export const reanalysisStatusMeta: Record<
  ReanalysisStatus,
  { label: string; type: 'success' | 'warning' | 'danger' | 'info' | 'primary'; color: string }
> = {
  pending: { label: '待分析', type: 'info', color: 'var(--app-neutral-400)' },
  running: { label: '分析中', type: 'primary', color: 'var(--app-brand-500)' },
  done: { label: '已完成', type: 'success', color: 'var(--app-success-500)' },
  failed: { label: '失败', type: 'danger', color: 'var(--app-danger-500)' },
}

// 五维指标中文标签（用于 feedback.metrics 展示）
export type RecycleMetricKey = 'play' | 'completeRate' | 'interact' | 'fanInc' | 'commission'

export const recycleMetricMeta: Record<RecycleMetricKey, { label: string; unit: string }> = {
  play: { label: '播放', unit: '' },
  completeRate: { label: '完播率', unit: '%' },
  interact: { label: '互动', unit: '' },
  fanInc: { label: '涨粉', unit: '' },
  commission: { label: '佣金', unit: '¥' },
}

// 五维指标顺序（用于标签组渲染）
export const recycleMetricOrder: RecycleMetricKey[] = [
  'play',
  'completeRate',
  'interact',
  'fanInc',
  'commission',
]
