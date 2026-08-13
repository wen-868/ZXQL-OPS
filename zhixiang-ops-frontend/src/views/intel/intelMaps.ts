import type { CollectStatus, HotType, Platform } from '@/api/intel'

// 平台中文名（含 local 自建源）
export const platformLabels: Record<Platform, string> = {
  douyin: '抖音',
  kuaishou: '快手',
  xiaohongshu: '小红书',
  bilibili: 'B站',
  'wechat-channels': '视频号',
  local: '自建源',
}

// 平台下拉选项
export const platformOptions = Object.entries(platformLabels).map(
  ([value, label]) => ({ value: value as Platform, label }),
)

// 采集层级选项
export const sourceLevelOptions = [
  { value: 'L1', label: 'L1（一级源头）' },
  { value: 'L2', label: 'L2（二级扩散）' },
]

// 热点类型选项
export const hotTypeLabels: Record<HotType, string> = {
  video: '视频',
  live: '直播',
  topic: '话题',
  brand: '品牌',
}
export const hotTypeOptions = Object.entries(hotTypeLabels).map(
  ([value, label]) => ({ value: value as HotType, label }),
)

// 采集任务状态色映射
export const collectStatusMeta: Record<
  CollectStatus,
  { label: string; type: 'success' | 'warning' | 'danger' | 'info' | 'default' }
> = {
  pending: { label: '排队中', type: 'info' },
  running: { label: '采集中', type: 'warning' },
  done: { label: '已完成', type: 'success' },
  failed: { label: '失败', type: 'danger' },
}
