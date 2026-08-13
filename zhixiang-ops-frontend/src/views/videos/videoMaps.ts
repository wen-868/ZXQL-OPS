import type { VideoStatus, ReviewStatus } from '@/api/videos'

// ============ 成片状态（3 态）============
// draft 草稿 / editing 剪辑中 / done 完成
export const videoStatusMeta: Record<
  VideoStatus,
  { label: string; type: 'success' | 'warning' | 'danger' | 'info' | 'primary'; color: string }
> = {
  draft: { label: '草稿', type: 'info', color: 'var(--app-neutral-400)' },
  editing: { label: '剪辑中', type: 'warning', color: 'var(--app-warning-500)' },
  done: { label: '完成', type: 'success', color: 'var(--app-success-500)' },
}

// 状态下拉选项
export const videoStatusOptions = Object.entries(videoStatusMeta).map(
  ([value, meta]) => ({ value: value as VideoStatus, label: meta.label }),
)

// ============ 送审状态（4 态）============
// pending 待审 / reviewing 审核中 / passed 通过 / rejected 驳回
export const reviewStatusMeta: Record<
  ReviewStatus,
  { label: string; type: 'success' | 'warning' | 'danger' | 'info' | 'primary'; color: string }
> = {
  pending: { label: '待审', type: 'info', color: 'var(--app-neutral-400)' },
  reviewing: { label: '审核中', type: 'primary', color: 'var(--app-brand-500)' },
  passed: { label: '通过', type: 'success', color: 'var(--app-success-500)' },
  rejected: { label: '驳回', type: 'danger', color: 'var(--app-danger-500)' },
}

// 送审状态下拉选项
export const reviewStatusOptions = Object.entries(reviewStatusMeta).map(
  ([value, meta]) => ({ value: value as ReviewStatus, label: meta.label }),
)

// ============ 比例（下拉可选）============
export const ratioOptions = [
  { value: '9:16', label: '9:16 竖屏' },
  { value: '1:1', label: '1:1 方形' },
  { value: '16:9', label: '16:9 横屏' },
]
