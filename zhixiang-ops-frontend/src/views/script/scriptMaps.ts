import type { ScriptStatus, ComplianceLevel } from '@/api/script'
import {
  emotionLabels,
  emotionColors,
  emotionOptions,
} from '@/views/analyze/analyzeMaps'

// 复用 D 页 6 情绪映射，避免重复定义
export { emotionLabels, emotionColors, emotionOptions }

// ============ 脚本状态机（4 状态）============
// draft 草稿 / reviewing 审核中 / approved 已通过 / published 已发布
export const scriptStatusMeta: Record<
  ScriptStatus,
  { label: string; type: 'success' | 'warning' | 'danger' | 'info' | 'primary' }
> = {
  draft: { label: '草稿', type: 'info' },
  reviewing: { label: '审核中', type: 'warning' },
  approved: { label: '已通过', type: 'success' },
  published: { label: '已发布', type: 'primary' },
}

// 状态下拉选项
export const scriptStatusOptions = Object.entries(scriptStatusMeta).map(
  ([value, meta]) => ({ value: value as ScriptStatus, label: meta.label }),
)

// 合法状态流转（状态机）
// draft → reviewing ；reviewing → approved/reviewing(回退不强制) ；approved → published ；published 终态
export const scriptStatusTransitions: Record<ScriptStatus, ScriptStatus[]> = {
  draft: ['reviewing'],
  reviewing: ['approved', 'draft'],
  approved: ['published', 'reviewing'],
  published: [],
}

// 取状态机允许的合法流转选项（含当前态，用于编辑抽屉 status 下拉）
export function allowedScriptStatusOptions(current: ScriptStatus): { value: ScriptStatus; label: string }[] {
  const next = scriptStatusTransitions[current] || []
  return [current, ...next].map((s) => ({ value: s, label: scriptStatusMeta[s].label }))
}

// ============ 合规级别（4 级）============
// none 无 / low 低 / medium 中 / high 高
export const complianceLevelMeta: Record<
  ComplianceLevel,
  { label: string; type: 'success' | 'warning' | 'danger' | 'info' | 'primary'; color: string }
> = {
  none: { label: '无风险', type: 'success', color: 'var(--app-success-500)' },
  low: { label: '低风险', type: 'primary', color: 'var(--app-brand-500)' },
  medium: { label: '中风险', type: 'warning', color: 'var(--app-warning-500)' },
  high: { label: '高危', type: 'danger', color: 'var(--app-danger-500)' },
}

// 高危禁用发布标记
export function isHighRisk(level?: ComplianceLevel): boolean {
  return level === 'high'
}
