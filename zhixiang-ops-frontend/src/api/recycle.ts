import request from '@/utils/request'
import type { RecycleScope, RecycleStatus, ReanalysisStatus } from '@/views/recycle/recycleMaps'

// ============ J 数据监控与回收（recycle）接口 ============
// 契约见 docs/API接口文档.md 对应章节 /api/ops/recycle + /feedback + /analysis/rerun
// 全部按请求头 tenantId 隔离（由 request 拦截器注入）

export type RecycleMetricKey = 'play' | 'completeRate' | 'interact' | 'fanInc' | 'commission'

// 发起回收入参
export interface CreateRecyclePayload {
  scope: RecycleScope
  targetRef: string
  metrics?: Record<string, number>
  comments?: string[]
}

// 发起回收返回
export interface CreateRecycleResult {
  taskId: number
  traceId: string
}

// 回收任务详情
export interface RecycleTask {
  id: number
  scope: RecycleScope
  targetRef: string
  status: RecycleStatus
  progress: number
  lastCollectedAt?: string | null
  createdAt: string
  updatedAt: string
}

// 单视频回收明细（feedback）
export interface FeedbackDetail {
  id: number
  topicId?: number | null
  videoId?: number | null
  platform?: string | null
  attributionId: string
  metrics?: Partial<Record<RecycleMetricKey, number>> | null
  comments?: string[] | null
  reAnalysisId?: number | null
  collectedAt?: string | null
}

// 单视频回收明细返回（含回流再分析状态）
export interface FeedbackResult {
  feedback: FeedbackDetail
  reanalysisStatus?: ReanalysisStatus
}

// 回流再分析返回
export interface RerunAnalysisResult {
  analysisId: number
  traceId: string
  feedbackCount: number
}

// ===== 发起回收 =====
export function createRecycle(payload: CreateRecyclePayload) {
  return request.post<CreateRecycleResult>('/ops/recycle', payload).then((r) => r.data)
}

// ===== 回收任务进度 =====
export function getRecycle(id: number) {
  return request.get<RecycleTask>(`/ops/recycle/${id}`).then((r) => r.data)
}

// ===== 单视频回收明细 =====
export function getFeedback(videoId: number) {
  return request.get<FeedbackResult>(`/ops/feedback/${videoId}`).then((r) => r.data)
}

// ===== 回流 D 再分析 =====
export function rerunAnalysis() {
  return request.post<RerunAnalysisResult>('/ops/analysis/rerun').then((r) => r.data)
}
