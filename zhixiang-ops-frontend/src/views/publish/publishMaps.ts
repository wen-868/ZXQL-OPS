import type { PublishStatus, PublishPlatform } from '@/api/publish'

// ============ 发布状态（6 态）============
// queued 排队 / running 执行中 / done 完成 / failed 失败 / published 已发布 / retry 重试
export const publishStatusMeta: Record<
  PublishStatus,
  { label: string; type: 'success' | 'warning' | 'danger' | 'info' | 'primary'; color: string }
> = {
  queued: { label: '排队中', type: 'info', color: 'var(--app-neutral-400)' },
  running: { label: '执行中', type: 'primary', color: 'var(--app-brand-500)' },
  done: { label: '完成', type: 'success', color: 'var(--app-success-500)' },
  failed: { label: '失败', type: 'danger', color: 'var(--app-danger-500)' },
  published: { label: '已发布', type: 'success', color: 'var(--app-success-600)' },
  retry: { label: '重试中', type: 'warning', color: 'var(--app-warning-500)' },
}

// 平台下拉选项
export const platformOptions: { value: PublishPlatform; label: string }[] = [
  { value: 'douyin', label: '抖音' },
  { value: 'kuaishou', label: '快手' },
  { value: 'xiaohongshu', label: '小红书' },
  { value: 'bilibili', label: 'B站' },
  { value: 'wechat-channels', label: '视频号' },
]

// 平台中文名（短标签）
export const platformLabel: Record<PublishPlatform, string> = {
  douyin: '抖音',
  kuaishou: '快手',
  xiaohongshu: '小红书',
  bilibili: 'B站',
  'wechat-channels': '视频号',
}
