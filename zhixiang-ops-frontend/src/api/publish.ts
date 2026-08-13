import request from '@/utils/request'

// ============ I 发布与分发（I-core）接口 ============
// 契约见 docs/API接口文档.md 第五章 I 发布与分发 /api/ops/publish
// 全部按请求头 tenantId 隔离（由 request 拦截器注入）

// 发布状态机（6 态）
export type PublishStatus =
  | 'queued'
  | 'running'
  | 'done'
  | 'failed'
  | 'published'
  | 'retry'

// 平台（复用 accounts 的 Platform 取值）
export type PublishPlatform =
  | 'douyin'
  | 'kuaishou'
  | 'xiaohongshu'
  | 'bilibili'
  | 'wechat-channels'

// 发布任务
export interface PublishTask {
  id: number
  tenantId: string
  scriptId: number
  accountId: number
  platform: PublishPlatform
  attributionId: string
  videoId?: number
  scheduledAt?: string
  status: PublishStatus
  retryCount: number
  errorMsg?: string
  extPostId?: string
  cartProductId?: string
  cartClicks: number
  orderConv: number
  publishedAt?: string
  createdAt: string
  updatedAt: string
}

// 一键分发入参
export interface PublishPayload {
  scriptId: number
  accountIds: number[]
  platform?: string
  scheduledAt?: string
  cartProductId?: string
}

// 批量分发单条
export interface BatchPublishItem {
  scriptId: number
  accountIds: number[]
  platform?: string
  scheduledAt?: string
  cartProductId?: string
}

// 批量分发入参
export interface BatchPublishPayload {
  tasks: BatchPublishItem[]
}

// 分发返回
export interface PublishResult {
  taskIds: number[]
  traceId: string
}

// 挂车转化漏斗
export interface FunnelResult {
  cartClicks: number
  orderConv: number
  conversionRate: number
}

// ===== 一键分发 =====
export function publish(payload: PublishPayload) {
  return request.post<PublishResult>('/ops/publish', payload).then((r) => r.data)
}

// ===== 批量分发 =====
export function batchPublish(payload: BatchPublishPayload) {
  return request.post<PublishResult>('/ops/publish/batch', payload).then((r) => r.data)
}

// ===== 发布详情 =====
export function getPublish(id: number) {
  return request.get<PublishTask>(`/ops/publish/${id}`).then((r) => r.data)
}

// ===== 挂车转化漏斗 =====
export function getFunnel(id: number) {
  return request.get<FunnelResult>(`/ops/publish/${id}/funnel`).then((r) => r.data)
}
