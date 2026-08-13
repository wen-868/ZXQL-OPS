import request from '@/utils/request'

// ============ E 选题引擎（E-core）接口 ============
// 契约见 docs/API接口文档.md 第三章 E 选题 /api/ops/topic
// 全部按请求头 tenantId 隔离（由 request 拦截器注入）

// 人性 driver（与 D 对齐）
export type HumanDriver =
  | '贪'
  | '懒'
  | '怕'
  | '虚荣'
  | '窥探'
  | '孤独爱'
  | '愤怒不公'

// 情绪 emotion（与 D 对齐）
export type HumanEmotion =
  | '愤怒'
  | '共鸣'
  | '好奇'
  | '感动'
  | '焦虑'
  | '爽感'

// 选题状态机
export type TopicStatus =
  | 'idea' // 创意
  | 'todo' // 待写
  | 'written' // 已写
  | 'shot' // 已拍
  | 'published' // 已发布
  | 'dead' // 废弃

// 选题
export interface Topic {
  id: number
  tenantId: string
  analysisId?: number
  attributionId: string
  title: string
  humanDriver: HumanDriver
  emotion: HumanEmotion
  formulaTags?: string[]
  status: TopicStatus
  score: number
  abVariantOf?: number
  scheduledAt?: string
  accountId?: string
  promptVersion: string
  modelUsed: string
  createdAt: string
  updatedAt: string
}

// 生成入参
export interface TopicGeneratePayload {
  driver?: HumanDriver
  emotion?: HumanEmotion
  limit?: number
  analysisId?: number
}

// 生成返回
export interface TopicGenerateResult {
  topics: Topic[]
  traceId: string
}

// 列表返回
export interface TopicListResult {
  list: Topic[]
  total: number
  page: number
  pageSize: number
}

// 列表查询参数
export interface TopicQuery {
  page?: number
  pageSize?: number
  driver?: string
  emotion?: string
  status?: string
}

// 更新入参
export interface TopicUpdatePayload {
  title?: string
  humanDriver?: HumanDriver
  emotion?: HumanEmotion
  formulaTags?: string[]
  status?: TopicStatus
  score?: number
  scheduledAt?: string
  accountId?: string
}

// 创建 A/B 变体入参
export interface TopicAbPayload {
  title?: string
  humanDriver?: HumanDriver
  emotion?: HumanEmotion
  formulaTags?: string[]
  scheduledAt?: string
  accountId?: string
}

// 排期入参
export interface TopicSchedulePayload {
  scheduledAt: string
  accountId?: string
}

// ===== 生成 =====
export function generateTopics(payload: TopicGeneratePayload) {
  return request.post<TopicGenerateResult>('/ops/topic/generate', payload).then((r) => r.data)
}

// ===== 列表 =====
export function listTopics(query: TopicQuery) {
  return request.get<TopicListResult>('/ops/topic/topics', { params: query }).then((r) => r.data)
}

// ===== 详情 =====
export function getTopic(id: number) {
  return request.get<Topic>(`/ops/topic/topics/${id}`).then((r) => r.data)
}

// ===== 更新 =====
export function updateTopic(id: number, payload: TopicUpdatePayload) {
  return request.patch<Topic>(`/ops/topic/topics/${id}`, payload).then((r) => r.data)
}

// ===== 创建 A/B 变体 =====
export function createTopicAb(id: number, payload: TopicAbPayload) {
  return request.post<Topic>(`/ops/topic/topics/${id}/ab`, payload).then((r) => r.data)
}

// ===== 排期 =====
export function scheduleTopic(id: number, payload: TopicSchedulePayload) {
  return request.post<Topic>(`/ops/topic/topics/${id}/schedule`, payload).then((r) => r.data)
}
