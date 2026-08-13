import type { TopicStatus } from '@/api/topic'
import {
  driverLabels,
  driverColors,
  driverOptions,
  emotionLabels,
  emotionColors,
  emotionOptions,
} from '@/views/analyze/analyzeMaps'

// 复用 D 页人性/情绪映射，避免重复定义
export { driverLabels, driverColors, driverOptions, emotionLabels, emotionColors, emotionOptions }

// 6 状态中文标签 + 颜色（el-tag type）
export const topicStatusMeta: Record<
  TopicStatus,
  { label: string; type: 'success' | 'warning' | 'danger' | 'info' | 'primary' }
> = {
  idea: { label: '创意', type: 'info' },
  todo: { label: '待写', type: 'warning' },
  written: { label: '已写', type: 'primary' },
  shot: { label: '已拍', type: 'primary' },
  published: { label: '已发布', type: 'success' },
  dead: { label: '废弃', type: 'danger' },
}

// 状态下拉选项
export const topicStatusOptions = Object.entries(topicStatusMeta).map(
  ([value, meta]) => ({ value: value as TopicStatus, label: meta.label }),
)

// 合法状态流转：每个状态可推进到的下一目标（状态机）
// idea → todo ；todo → written/dead ；written → shot/dead ；shot → published/dead ；published 终态 ；dead 终态
export const topicStatusTransitions: Record<TopicStatus, TopicStatus[]> = {
  idea: ['todo'],
  todo: ['written', 'dead'],
  written: ['shot', 'dead'],
  shot: ['published', 'dead'],
  published: [],
  dead: [],
}

// 状态推进按钮文案（仅取主推进方向，dead 之外）
export const topicStatusNext: Partial<Record<TopicStatus, TopicStatus>> = {
  idea: 'todo',
  todo: 'written',
  written: 'shot',
  shot: 'published',
}

// 取状态机允许的合法流转选项（用于编辑抽屉 status 下拉）
export function allowedStatusOptions(current: TopicStatus): { value: TopicStatus; label: string }[] {
  const next = topicStatusTransitions[current] || []
  return [current, ...next].map((s) => ({ value: s, label: topicStatusMeta[s].label }))
}
