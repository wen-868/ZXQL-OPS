import type { CollectStatus, HotType, Platform, ReviewStatus } from '@/api/intel'

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

// 采集源内容类型
export const sourceTypeLabels: Record<string, string> = {
  comment: '评论',
  hot: '热点',
  keyword: '关键词',
  url: '页面',
}
export const sourceTypeOptions = Object.entries(sourceTypeLabels).map(
  ([value, label]) => ({ value, label }),
)

// 采集模式
export const sourceModeLabels: Record<string, string> = {
  web: '网页抓取（真实）',
  local: '本地样本（联调）',
}
export const sourceModeOptions = Object.entries(sourceModeLabels).map(
  ([value, label]) => ({ value, label }),
)

// 清洗开关中文
export const cleaningOptionLabels: { key: string; label: string }[] = [
  { key: 'dedup', label: '去重' },
  { key: 'piiStrip', label: '脱敏' },
  { key: 'adFilter', label: '广告过滤' },
  { key: 'reviewRequired', label: '人工审核' },
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

// 采集任务状态色映射（含人工控制态）
export const collectStatusMeta: Record<
  CollectStatus,
  { label: string; type: 'success' | 'warning' | 'danger' | 'info' | 'default' }
> = {
  pending: { label: '排队中', type: 'info' },
  running: { label: '采集中', type: 'warning' },
  paused: { label: '已暂停', type: 'default' },
  cancelled: { label: '已取消', type: 'danger' },
  done: { label: '已完成', type: 'success' },
  failed: { label: '失败', type: 'danger' },
}

// 审核状态映射
export const reviewStatusMeta: Record<
  ReviewStatus,
  { label: string; type: 'success' | 'warning' | 'danger' | 'info' | 'default' }
> = {
  pending: { label: '待审核', type: 'warning' },
  approved: { label: '已通过', type: 'success' },
  rejected: { label: '已驳回', type: 'danger' },
}
export const reviewStatusOptions: { value: ReviewStatus; label: string }[] = [
  { value: 'pending', label: '待审核' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已驳回' },
]
