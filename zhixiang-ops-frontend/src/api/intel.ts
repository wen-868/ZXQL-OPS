import request from '@/utils/request'

// ============ C 情报采集（C-core）接口 ============
// 契约见 docs/API接口文档.md 第三章 C 情报采集 /api/ops/intel
// 全部按请求头 tenantId 隔离（由 request 拦截器注入）

// 平台枚举（含 local 自建源）
export type Platform =
  | 'douyin'
  | 'kuaishou'
  | 'xiaohongshu'
  | 'bilibili'
  | 'wechat-channels'
  | 'local'

// 竞品
export interface Competitor {
  id: number
  tenantId: string
  platform: Platform
  name: string
  url: string
  category: string
  monitorEnabled: boolean
  createdAt: string
  updatedAt: string
}

// 竞品创建入参
export interface CompetitorPayload {
  platform: Platform
  name: string
  url: string
  category: string
}

// 竞品更新入参（局部）
export interface CompetitorPatch {
  name?: string
  url?: string
  category?: string
  monitorEnabled?: boolean
}

// 采集任务状态（含人工控制态）
export type CollectStatus = 'pending' | 'running' | 'paused' | 'cancelled' | 'done' | 'failed'

// 任务生命周期控制动作
export type CollectControlAction = 'pause' | 'resume' | 'cancel' | 'retry'

// 评论审核状态
export type ReviewStatus = 'pending' | 'approved' | 'rejected'

// 清洗开关
export interface CleaningOptions {
  dedup?: boolean
  piiStrip?: boolean
  adFilter?: boolean
  reviewRequired?: boolean
}

// 采集源（ops_collect_sources）
export interface CollectSource {
  id: number
  tenantId: string
  name: string
  platform: Platform
  sourceType: 'comment' | 'hot' | 'keyword' | 'url'
  target: string
  mode: 'web' | 'local'
  rateLimit: number
  cleaning?: CleaningOptions
  config?: Record<string, unknown>
  enabled: boolean
  lastCollectedAt?: string
  collectCount: number
  errorMsg?: string
  createdAt: string
  updatedAt: string
}

// 采集源创建入参
export interface SourcePayload {
  name: string
  platform: Platform
  sourceType: 'comment' | 'hot' | 'keyword' | 'url'
  target: string
  mode: 'web' | 'local'
  rateLimit?: number
  cleaning?: CleaningOptions
  config?: Record<string, unknown>
}

// 采集源更新入参（局部）
export type SourcePatch = Partial<SourcePayload> & { enabled?: boolean }

// 发起采集返回
export interface CollectSubmitResult {
  taskId: number
  traceId: string
}

// 采集任务（列表/详情）
export interface CollectTask {
  id: number
  type: string
  target: string
  platform: Platform
  sourceLevel: 'L1' | 'L2'
  status: CollectStatus
  progress: number
  collectedCount: number
  retryCount: number
  sourceId?: number
  cleaning?: CleaningOptions
  pausedAt?: string
  errorMsg?: string
  finishedAt?: string
  createdAt: string
  updatedAt: string
}

// 发起采集入参
export interface CollectPayload {
  type: 'comment'
  target: string
  platform: Platform
  sourceLevel: 'L1' | 'L2'
  scope?: string[]
  fieldsCollected?: string[]
  cleaning?: CleaningOptions
}

// 已采集评论
export interface CollectedComment {
  id: number
  platform: Platform
  sourceType: string
  sourceRef: string
  content: string
  authorId: string
  likes: number
  isClean: boolean
  reviewStatus: ReviewStatus
  cleanResult: {
    piiRemoved: string[]
    ad: boolean
  }
  contentHash: string
  collectedAt: string
  taskId: string
  createdAt: string
  updatedAt: string
}

// 评论分页查询参数
export interface CommentQuery {
  page?: number
  pageSize?: number
  isClean?: boolean
  platform?: Platform
  reviewStatus?: ReviewStatus
}

// 关键词挖掘入参/返回
export interface KeywordMinePayload {
  platform: Platform
  target: string
}

// 热点类型
export type HotType = 'video' | 'live' | 'topic' | 'brand'

// 热点快照（字段以实际为准，缺失用占位）
export interface HotSnapshot {
  id?: number
  title?: string
  heat?: number
  platform?: Platform
  hotType?: HotType
  url?: string
  rank?: number
  [key: string]: unknown
}

// ===== 采集源配置 =====
// 列表
export function listSources() {
  return request.get<CollectSource[]>('/ops/intel/sources').then((r) => r.data)
}
// 创建
export function createSource(payload: SourcePayload) {
  return request.post<CollectSource>('/ops/intel/sources', payload).then((r) => r.data)
}
// 更新
export function updateSource(id: number, payload: SourcePatch) {
  return request
    .patch<CollectSource>(`/ops/intel/sources/${id}`, payload)
    .then((r) => r.data)
}
// 删除（软删）
export function deleteSource(id: number) {
  return request.delete<{ id: number }>(`/ops/intel/sources/${id}`).then((r) => r.data)
}
// 由采集源发起一次采集（继承源配置：cleaning/rateLimit/target）
export function collectFromSource(id: number) {
  return request
    .post<CollectSubmitResult>(`/ops/intel/sources/${id}/collect`)
    .then((r) => r.data)
}

// ===== 竞品库 =====
// 列表
export function listCompetitors() {
  return request.get<Competitor[]>('/ops/intel/competitors').then((r) => r.data)
}
// 创建
export function createCompetitor(payload: CompetitorPayload) {
  return request.post<Competitor>('/ops/intel/competitors', payload).then((r) => r.data)
}
// 详情
export function getCompetitor(id: number) {
  return request.get<Competitor>(`/ops/intel/competitors/${id}`).then((r) => r.data)
}
// 更新
export function updateCompetitor(id: number, payload: CompetitorPatch) {
  return request
    .patch<Competitor>(`/ops/intel/competitors/${id}`, payload)
    .then((r) => r.data)
}
// 删除（软删）
export function deleteCompetitor(id: number) {
  return request
    .delete<{ id: number }>(`/ops/intel/competitors/${id}`)
    .then((r) => r.data)
}
// 监控开关翻转
export function toggleMonitor(id: number) {
  return request
    .post<Competitor>(`/ops/intel/competitors/${id}/monitor`)
    .then((r) => r.data)
}

// ===== 采集任务 =====
// 发起（不经过采集源，直接建任务）
export function submitCollect(payload: CollectPayload) {
  return request.post<CollectSubmitResult>('/ops/intel/collect', payload).then((r) => r.data)
}
// 进度/详情
export function getCollectTask(id: number) {
  return request.get<CollectTask>(`/ops/intel/collect/${id}`).then((r) => r.data)
}
// 任务列表（分页）
export function listCollectTasks(query: { page?: number; pageSize?: number }) {
  return request
    .get<{ list: CollectTask[]; total: number; page: number; pageSize: number }>(
      '/ops/intel/collect',
      { params: query },
    )
    .then((r) => r.data)
}
// 任务生命周期控制：pause / resume / cancel / retry
export function controlCollectTask(id: number, action: CollectControlAction) {
  return request
    .post<CollectTask>(`/ops/intel/collect/${id}/control`, { action })
    .then((r) => r.data)
}

// ===== 采集评论 / 审核 =====
// 分页列表（可按审核状态过滤）
export function listCollectedComments(query: CommentQuery) {
  return request
    .get<{ list: CollectedComment[]; total: number; page: number; pageSize: number }>(
      '/ops/intel/collected-comments',
      { params: query },
    )
    .then((r) => r.data)
}
// 单条审核
export function reviewComment(id: number, status: ReviewStatus) {
  return request
    .post<CollectedComment>(`/ops/intel/comments/${id}/review`, { status })
    .then((r) => r.data)
}
// 批量审核
export function reviewCommentsBatch(ids: number[], status: ReviewStatus) {
  return request
    .post<{ updated: number }>('/ops/intel/comments/review-batch', { ids, status })
    .then((r) => r.data)
}

// ===== 关键词挖掘 =====
export function mineKeywords(payload: KeywordMinePayload) {
  return request.post<string[]>('/ops/intel/keywords/mine', payload).then((r) => r.data)
}

// ===== 热点榜 =====
export function getHot(platform: Platform, hotType: HotType) {
  return request
    .get<HotSnapshot[]>('/ops/intel/hot', { params: { platform, hotType } })
    .then((r) => r.data)
}
