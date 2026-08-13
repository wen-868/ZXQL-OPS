import type { MaterialType, MaterialSource, MaterialStatus } from '@/api/materials'

// ============ 素材类型（6 类）============
// image 图片 / video 视频 / music 音乐 / subtitle 字幕 / sticker 贴纸 / avatar 数字人
export const materialTypeMeta: Record<
  MaterialType,
  { label: string; type: 'success' | 'warning' | 'danger' | 'info' | 'primary'; color: string }
> = {
  image: { label: '图片', type: 'primary', color: 'var(--app-brand-500)' },
  video: { label: '视频', type: 'success', color: 'var(--app-success-500)' },
  music: { label: '音乐', type: 'warning', color: 'var(--app-warning-500)' },
  subtitle: { label: '字幕', type: 'info', color: 'var(--app-neutral-400)' },
  sticker: { label: '贴纸', type: 'danger', color: 'var(--app-danger-500)' },
  avatar: { label: '数字人', type: 'primary', color: 'var(--app-info-500)' },
}

// 类型下拉选项
export const materialTypeOptions = Object.entries(materialTypeMeta).map(
  ([value, meta]) => ({ value: value as MaterialType, label: meta.label }),
)

// ============ 素材来源（4 类）============
// jimeng 即梦 / keling 可灵 / local 本地 / upload 上传
export const materialSourceMeta: Record<
  MaterialSource,
  { label: string; type: 'success' | 'warning' | 'danger' | 'info' | 'primary'; color: string }
> = {
  jimeng: { label: '即梦', type: 'primary', color: 'var(--app-brand-500)' },
  keling: { label: '可灵', type: 'success', color: 'var(--app-success-500)' },
  local: { label: '本地', type: 'info', color: 'var(--app-neutral-400)' },
  upload: { label: '上传', type: 'warning', color: 'var(--app-warning-500)' },
}

// 来源下拉选项（全量，用于筛选）
export const materialSourceOptions = Object.entries(materialSourceMeta).map(
  ([value, meta]) => ({ value: value as MaterialSource, label: meta.label }),
)

// AI 生成来源选项（仅 jimeng/keling/local）
export const aiSourceOptions = materialSourceOptions.filter((o) =>
  ['jimeng', 'keling', 'local'].includes(o.value),
)

// ============ 素材状态（4 态）============
// pending 待生成 / generated 已生成 / uploaded 已上传 / failed 失败
export const materialStatusMeta: Record<
  MaterialStatus,
  { label: string; type: 'success' | 'warning' | 'danger' | 'info' | 'primary'; color: string }
> = {
  pending: { label: '待生成', type: 'info', color: 'var(--app-neutral-400)' },
  generated: { label: '已生成', type: 'success', color: 'var(--app-success-500)' },
  uploaded: { label: '已上传', type: 'primary', color: 'var(--app-brand-500)' },
  failed: { label: '失败', type: 'danger', color: 'var(--app-danger-500)' },
}

// 状态下拉选项
export const materialStatusOptions = Object.entries(materialStatusMeta).map(
  ([value, meta]) => ({ value: value as MaterialStatus, label: meta.label }),
)
