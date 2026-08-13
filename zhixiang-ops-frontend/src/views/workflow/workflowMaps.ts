import type {
  WorkflowNodeType,
  WorkflowTrigger,
  WorkflowRunStatus,
  WorkflowNodeLogStatus,
} from '@/api/workflow'

// ============ 节点类型（6）============
// collect 采集 / analyze 分析 / ideate 选题 / script 脚本 / publish 发布 / recycle 回收
export const nodeTypeMeta: Record<
  WorkflowNodeType,
  { label: string; type: 'success' | 'warning' | 'danger' | 'info' | 'primary'; color: string }
> = {
  collect: { label: '采集', type: 'info', color: 'var(--app-neutral-400)' },
  analyze: { label: '分析', type: 'primary', color: 'var(--app-brand-500)' },
  ideate: { label: '选题', type: 'success', color: 'var(--app-success-500)' },
  script: { label: '脚本', type: 'warning', color: 'var(--app-warning-500)' },
  publish: { label: '发布', type: 'danger', color: 'var(--app-danger-500)' },
  recycle: { label: '回收', type: 'info', color: 'var(--app-info-500)' },
}

// 节点类型下拉选项（顺序按 C→D→E→F→I→J）
export const nodeTypeOptions: { value: WorkflowNodeType; label: string }[] = [
  { value: 'collect', label: '采集(C)' },
  { value: 'analyze', label: '分析(D)' },
  { value: 'ideate', label: '选题(E)' },
  { value: 'script', label: '脚本(F)' },
  { value: 'publish', label: '发布(I)' },
  { value: 'recycle', label: '回收(J)' },
]

// ============ 触发方式（3）============
// manual 手动 / cron 定时 / event 事件
export const triggerMeta: Record<
  WorkflowTrigger,
  { label: string; type: 'success' | 'warning' | 'danger' | 'info' | 'primary'; color: string }
> = {
  manual: { label: '手动', type: 'info', color: 'var(--app-neutral-400)' },
  cron: { label: '定时', type: 'primary', color: 'var(--app-brand-500)' },
  event: { label: '事件', type: 'warning', color: 'var(--app-warning-500)' },
}

export const triggerOptions: { value: WorkflowTrigger; label: string }[] = [
  { value: 'manual', label: '手动' },
  { value: 'cron', label: '定时' },
  { value: 'event', label: '事件' },
]

// ============ 运行整体状态（5）============
// queued 排队 / running 执行中 / success 成功 / failed 失败 / partial 部分成功
export const runStatusMeta: Record<
  WorkflowRunStatus,
  { label: string; type: 'success' | 'warning' | 'danger' | 'info' | 'primary'; color: string }
> = {
  queued: { label: '排队中', type: 'info', color: 'var(--app-neutral-400)' },
  running: { label: '执行中', type: 'primary', color: 'var(--app-brand-500)' },
  success: { label: '成功', type: 'success', color: 'var(--app-success-500)' },
  failed: { label: '失败', type: 'danger', color: 'var(--app-danger-500)' },
  partial: { label: '部分成功', type: 'warning', color: 'var(--app-warning-500)' },
}

// ============ 单节点日志状态（4）============
// running 运行 / done 完成 / failed 失败 / skipped 跳过
export const nodeLogStatusMeta: Record<
  WorkflowNodeLogStatus,
  { label: string; type: 'success' | 'warning' | 'danger' | 'info' | 'primary'; color: string }
> = {
  running: { label: '运行', type: 'primary', color: 'var(--app-brand-500)' },
  done: { label: '完成', type: 'success', color: 'var(--app-success-500)' },
  failed: { label: '失败', type: 'danger', color: 'var(--app-danger-500)' },
  skipped: { label: '跳过', type: 'info', color: 'var(--app-neutral-400)' },
}

// 节点类型 → 阶段模块简称（用于链路简链文本）
export const nodeTypeStageLabel: Record<WorkflowNodeType, string> = {
  collect: 'C采集',
  analyze: 'D分析',
  ideate: 'E选题',
  script: 'F脚本',
  publish: 'I发布',
  recycle: 'J回收',
}
