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

// 采集任务状态
export type CollectStatus = 'pending' | 'running' | 'done' | 'failed'

// 发起采集返回
export interface CollectSubmitResult {
  taskId: number
  traceId: string
}

// 采集任务进度
export interface CollectTask {
  id: number
  status: CollectStatus
  progress: number
  collectedCount: number
}

// 发起采集入参
export interface CollectPayload {
  type: 'comment'
  target: string
  platform: Platform
  sourceLevel: 'L1' | 'L2'
  scope?: string
  fieldsCollected?: string[]
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
  cleanResult: {
    piiRemoved: string[]
    ad: boolean
  }
  contentHash: string
  collectedAt: string
  taskId: number
  createdAt: string
  updatedAt: string
}

// 评论分页查询参数
export interface CommentQuery {
  page?: number
  pageSize?: number
  isClean?: boolean
  platform?: Platform
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
// 发起
export function submitCollect(payload: CollectPayload) {
  return request.post<CollectSubmitResult>('/ops/intel/collect', payload).then((r) => r.data)
}
// 进度
export function getCollectTask(id: number) {
  return request.get<CollectTask>(`/ops/intel/collect/${id}`).then((r) => r.data)
}

// ===== 采集评论 =====
// 分页列表
export function listCollectedComments(query: CommentQuery) {
  return request
    .get<{ list: CollectedComment[]; total: number; page: number; pageSize: number }>(
      '/ops/intel/collected-comments',
      { params: query },
    )
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
