import request from '@/utils/request'

// ============ D 人性分析与洞察（D-core）接口 ============
// 契约见 docs/API接口文档.md 第三章 D 人性分析 /api/ops/analyze
// 全部按请求头 tenantId 隔离（由 request 拦截器注入）

// 7 人性 driver
export type HumanDriver =
  | '贪'
  | '懒'
  | '怕'
  | '虚荣'
  | '窥探'
  | '孤独爱'
  | '愤怒不公'

// 6 情绪 emotion
export type HumanEmotion =
  | '愤怒'
  | '共鸣'
  | '好奇'
  | '感动'
  | '焦虑'
  | '爽感'

// 数据来源
export type AnalysisSource = 'comments' | 'live' | 'ad'

// 任务状态
export type AnalysisStatus = 'pending' | 'running' | 'done' | 'failed'

// 发起分析入参
export interface AnalysisPayload {
  source: AnalysisSource
  platform?: string
  inputRefs?: string[]
  commentLimit?: number
}

// 发起分析返回
export interface AnalysisSubmitResult {
  taskId: number
  traceId: string
}

// 洞察结论
export interface AnalysisInsight {
  title: string
  content: string
  driver: HumanDriver
  emotion: HumanEmotion
  category?: string
  tags?: string[]
}

// 分析任务进度/结果
export interface AnalysisTask {
  id: number
  source: AnalysisSource
  platform?: string
  status: AnalysisStatus
  progress: number
  totalComments: number
  driverCounts: Partial<Record<HumanDriver, number>>
  emotionScores: Partial<Record<HumanEmotion, number>>
  topDrivers: HumanDriver[]
  topEmotions: HumanEmotion[]
  insights: AnalysisInsight[]
  modelUsed: string
  createdAt: string
}

// 聚合报告
export interface AnalysisReport {
  topDrivers: HumanDriver[]
  topEmotions: HumanEmotion[]
  driverCounts: Partial<Record<HumanDriver, number>>
  emotionScores: Partial<Record<HumanEmotion, number>>
  insights: AnalysisInsight[]
  recentTaskId?: number
}

// 沉淀洞察入参
export interface HumanInsightPayload {
  category: string
  driver: HumanDriver
  emotion: HumanEmotion
  title: string
  content: string
  tags?: string[]
}

// 洞察库条目
export interface HumanInsight {
  id: number
  tenantId: string
  category: string
  driver: HumanDriver
  emotion: HumanEmotion
  title: string
  content: string
  tags?: string[]
  refAnalysisId?: number
  usageCount: number
  createdAt: string
  updatedAt: string
}

// 洞察库列表返回
export interface InsightListResult {
  list: HumanInsight[]
  total: number
  page: number
  pageSize: number
}

// 洞察库查询参数
export interface InsightQuery {
  page?: number
  pageSize?: number
  driver?: string
  emotion?: string
  category?: string
}

// ===== 分析任务 =====
// 发起
export function submitAnalysis(payload: AnalysisPayload) {
  return request.post<AnalysisSubmitResult>('/ops/analyze/analysis', payload).then((r) => r.data)
}
// 进度/结果
export function getAnalysisTask(id: number) {
  return request.get<AnalysisTask>(`/ops/analyze/analysis/${id}`).then((r) => r.data)
}
// 最近聚合报告
export function getAnalysisReport() {
  return request.get<AnalysisReport>('/ops/analyze/analysis/report').then((r) => r.data)
}

// ===== 洞察知识库 =====
// 列表（按 usageCount 降序）
export function listInsights(query: InsightQuery) {
  return request
    .get<InsightListResult>('/ops/analyze/insights', { params: query })
    .then((r) => r.data)
}
// 沉淀
export function createInsight(payload: HumanInsightPayload) {
  return request.post<HumanInsight>('/ops/analyze/insights', payload).then((r) => r.data)
}
