import type { AnalysisSource, AnalysisStatus, HumanDriver, HumanEmotion } from '@/api/analyze'

// 7 人性 driver
export const driverLabels: Record<HumanDriver, string> = {
  贪: '贪',
  懒: '懒',
  怕: '怕',
  虚荣: '虚荣',
  窥探: '窥探',
  孤独爱: '孤独爱',
  愤怒不公: '愤怒不公',
}

// 7 人性色映射（用于分布条形/标签，对齐 variables.css 的 --app-driver-*）
export const driverColors: Record<HumanDriver, string> = {
  贪: 'var(--app-driver-greed)',
  懒: 'var(--app-driver-lazy)',
  怕: 'var(--app-driver-fear)',
  虚荣: 'var(--app-driver-vanity)',
  窥探: 'var(--app-driver-peep)',
  孤独爱: 'var(--app-driver-lonely)',
  愤怒不公: 'var(--app-driver-anger)',
}

// 人性下拉选项
export const driverOptions = Object.keys(driverLabels).map(
  (value) => ({ value: value as HumanDriver, label: driverLabels[value as HumanDriver] }),
)

// 6 情绪 emotion
export const emotionLabels: Record<HumanEmotion, string> = {
  愤怒: '愤怒',
  共鸣: '共鸣',
  好奇: '好奇',
  感动: '感动',
  焦虑: '焦虑',
  爽感: '爽感',
}

// 6 情绪色映射（对齐 variables.css 的 --app-emotion-*）
export const emotionColors: Record<HumanEmotion, string> = {
  愤怒: 'var(--app-emotion-anger)',
  共鸣: 'var(--app-emotion-resonance)',
  好奇: 'var(--app-emotion-curiosity)',
  感动: 'var(--app-emotion-touch)',
  焦虑: 'var(--app-emotion-anxiety)',
  爽感: 'var(--app-emotion-thrill)',
}

// 情绪下拉选项
export const emotionOptions = Object.keys(emotionLabels).map(
  (value) => ({ value: value as HumanEmotion, label: emotionLabels[value as HumanEmotion] }),
)

// 数据源选项
export const sourceLabels: Record<AnalysisSource, string> = {
  comments: '评论',
  live: '直播',
  ad: '广告',
}
export const sourceOptions = Object.entries(sourceLabels).map(
  ([value, label]) => ({ value: value as AnalysisSource, label }),
)

// 分析任务状态色映射
export const analysisStatusMeta: Record<
  AnalysisStatus,
  { label: string; type: 'success' | 'warning' | 'danger' | 'info' | 'primary' }
> = {
  pending: { label: '排队中', type: 'info' },
  running: { label: '分析中', type: 'warning' },
  done: { label: '已完成', type: 'success' },
  failed: { label: '失败', type: 'danger' },
}
