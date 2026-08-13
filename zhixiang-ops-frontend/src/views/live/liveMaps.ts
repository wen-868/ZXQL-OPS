// ============ K 直播中心（liveMaps）============
// 直播间类型 / 状态 / 弹幕 AI 应答状态 中文标签 + 颜色映射集中于此
// 组件内不散落硬编码色值，统一从此处取。
import type { LiveRoomType, LiveRoomStatus, LiveAiReplyStatus } from '@/api/live'

// 直播间类型
export const roomTypeMeta: Record<
  LiveRoomType,
  { label: string; color: string }
> = {
  real: { label: '真人', color: 'var(--app-brand-500)' },
  digital: { label: '数字人', color: 'var(--app-cat-purple)' },
}

export const roomTypeOptions: { value: LiveRoomType; label: string }[] = [
  { value: 'real', label: '真人' },
  { value: 'digital', label: '数字人' },
]

export const roomTypeColors: Record<LiveRoomType, string> = {
  real: 'var(--app-brand-500)',
  digital: 'var(--app-cat-purple)',
}

// 直播间状态
export const roomStatusMeta: Record<
  LiveRoomStatus,
  { label: string; type: 'info' | 'success' | 'warning'; color: string }
> = {
  created: { label: '未开播', type: 'info', color: 'var(--app-cat-ink)' },
  live: { label: '直播中', type: 'success', color: 'var(--app-success-500)' },
  ended: { label: '已结束', type: 'warning', color: 'var(--app-warning-500)' },
}

export const roomStatusOptions: { value: LiveRoomStatus; label: string }[] = [
  { value: 'created', label: '未开播' },
  { value: 'live', label: '直播中' },
  { value: 'ended', label: '已结束' },
]

export const roomStatusColors: Record<LiveRoomStatus, string> = {
  created: 'var(--app-cat-ink)',
  live: 'var(--app-success-500)',
  ended: 'var(--app-warning-500)',
}

export const roomStatusLabels: Record<LiveRoomStatus, string> = {
  created: '未开播',
  live: '直播中',
  ended: '已结束',
}

// 弹幕 AI 应答状态
export const aiReplyStatusMeta: Record<LiveAiReplyStatus, { label: string }> = {
  auto: { label: '自动回复' },
  pending: { label: '待确认' },
}

export const aiReplyStatusOptions: { value: LiveAiReplyStatus; label: string }[] = [
  { value: 'auto', label: '自动回复' },
  { value: 'pending', label: '待确认' },
]

export const aiReplyStatusLabels: Record<LiveAiReplyStatus, string> = {
  auto: '自动回复',
  pending: '待确认',
}
