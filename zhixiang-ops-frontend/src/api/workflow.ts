import request from '@/utils/request'

// ============ L 工作流编排（L-core）接口 ============
// 契约见 docs/API接口文档.md 对应章节 /api/ops/workflows
// 全部按请求头 tenantId 隔离（由 request 拦截器注入）

// 节点类型（6）
export type WorkflowNodeType =
  | 'collect'
  | 'analyze'
  | 'ideate'
  | 'script'
  | 'publish'
  | 'recycle'

// 触发方式（3）
export type WorkflowTrigger = 'manual' | 'cron' | 'event'

// 运行整体状态（5）
export type WorkflowRunStatus = 'queued' | 'running' | 'success' | 'failed' | 'partial'

// 单节点日志状态（4）
export type WorkflowNodeLogStatus = 'running' | 'done' | 'failed' | 'skipped'

// 节点
export interface WorkflowNode {
  id: string
  type: WorkflowNodeType
  config?: Record<string, unknown>
}

// 边
export interface WorkflowEdge {
  from: string
  to: string
  condition?: Record<string, unknown>
}

// 编排定义
export interface WorkflowDef {
  id: number
  name: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  trigger: WorkflowTrigger
  cronExpr?: string | null
  enabled: boolean
  createdAt: string
  updatedAt: string
}

// 新建编排入参
export interface CreateWorkflowPayload {
  name: string
  nodes: WorkflowNode[]
  edges?: WorkflowEdge[]
  trigger: WorkflowTrigger
  cronExpr?: string
  enabled?: boolean
}

// 更新编排入参（字段可选）
export type UpdateWorkflowPayload = Partial<CreateWorkflowPayload>

// 运行返回
export interface WorkflowRunResult {
  runId: number
  traceId: string
}

// 列表返回
export interface WorkflowListResult {
  list: WorkflowDef[]
  total: number
  page: number
  pageSize: number
}

// 单节点日志
export interface WorkflowNodeLog {
  id: number
  runId: number
  nodeId: string
  nodeType: string
  status: WorkflowNodeLogStatus
  input?: Record<string, unknown> | null
  output?: Record<string, unknown> | null
  traceId?: string | null
}

// SSE 事件数据结构
export interface WorkflowStreamEvent {
  run: {
    id: number
    defId: number
    status: WorkflowRunStatus
    progress: number
    startedAt?: string | null
    finishedAt?: string | null
  } | null
  logs: WorkflowNodeLog[]
}

// ===== 新建编排 =====
export function createWorkflow(payload: CreateWorkflowPayload) {
  return request.post<WorkflowDef>('/ops/workflows', payload).then((r) => r.data)
}

// ===== 编排列表 =====
export function listWorkflows(params: { page?: number; pageSize?: number } = {}) {
  return request
    .get<WorkflowListResult>('/ops/workflows', { params })
    .then((r) => r.data)
}

// ===== 更新编排 =====
export function updateWorkflow(id: number, payload: UpdateWorkflowPayload) {
  return request.post<WorkflowDef>(`/ops/workflows/${id}`, payload).then((r) => r.data)
}

// ===== 运行编排 =====
export function runWorkflow(id: number) {
  return request.post<WorkflowRunResult>(`/ops/workflows/${id}/run`).then((r) => r.data)
}
