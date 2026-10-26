import request from '@/utils/request'

// ============ 运营全链路自动化 /api/ops/automation ============
// 检索→筛选→上架→投流→验证 五阶段自动链；可指定阶段子集运行（如 检索→筛选 第一段）

// 自动化阶段
export type OpsStage = 'retrieve' | 'screen' | 'publish-up' | 'deliver' | 'verify'

export const OPS_STAGES: { value: OpsStage; label: string }[] = [
  { value: 'retrieve', label: '检索（情报采集）' },
  { value: 'screen', label: '筛选（选题择优）' },
  { value: 'publish-up', label: '上架（内容生产）' },
  { value: 'deliver', label: '投流（分发投放）' },
  { value: 'verify', label: '验证（回收回流）' },
]

// 策略元信息
export interface StrategyMeta {
  key: string
  stage: OpsStage
  name: string
  tech: string
  impl: string
  scenarios: string[]
  enabledByDefault: boolean
  desc: string
}

// 各阶段标准化产物
export interface OpsStageDetail {
  collectTaskIds?: number[]
  topicIds?: number[]
  scriptIds?: number[]
  publishTaskIds?: number[]
  recycleTaskIds?: number[]
  strategy?: string
  platform?: string
  chosen?: number
  channels?: string[]
  ratedTopics?: number
  feedbacks?: number
}

// 单阶段结果
export interface StageRunResult {
  strategy: string
  ok: boolean
  detail?: OpsStageDetail
  error?: string
}

// 链路运行返回
export interface ChainRunResult {
  chainRunId: string
  stages: Record<string, StageRunResult>
}

// 运行入参
export interface ChainRunPayload {
  stages?: OpsStage[]
  prefer?: Partial<Record<OpsStage, string>>
}

// 运行历史（内存保留最近 50 条）
export interface ChainRunRecord {
  id: string
  tenantId: string
  at: string
  stage: string
}

// 查询策略清单（可按阶段；返回扁平策略数组）
export async function listStrategies(stage?: OpsStage): Promise<StrategyMeta[]> {
  const r = await request
    .get<
      | { stage: OpsStage; count: number; strategies: StrategyMeta[] }
      | { stage: OpsStage; count: number; strategies: StrategyMeta[] }[]
    >('/ops/automation/strategies', { params: stage ? { stage } : {} })
  const data = r.data
  const groups = Array.isArray(data) ? data : [data]
  return groups.flatMap((g) => g.strategies)
}

// 触发自动链（管理员）
export function runChain(payload: ChainRunPayload) {
  return request.post<ChainRunResult>('/ops/automation/run', payload).then((r) => r.data)
}

// 写入租户阶段策略偏好（管理员）
export function setChainPrefer(pref: Partial<Record<OpsStage, string>>) {
  return request.post<{ ok: boolean }>('/ops/automation/prefer', { pref }).then((r) => r.data)
}

// 运行历史
export function listChainRuns() {
  return request.get<ChainRunRecord[]>('/ops/automation/runs').then((r) => r.data)
}

// ============ 视频自动化链 /api/ops/video-automation ============
// 情报→分析→选题→脚本→素材→成片→发布→复盘 八阶段（真实后端编排，演示数据未命中时阶段降级）

// 视频链单阶段结果
export interface VideoStageRunResult {
  strategy: string
  ok: boolean
  detail?: {
    strategy?: string
    collectTaskIds?: number[]
    analysisTaskIds?: number[]
    topicIds?: number[]
    scriptIds?: number[]
    materialIds?: number[]
    videoIds?: number[]
    publishTaskIds?: number[]
    recycleTaskIds?: number[]
    degraded?: boolean
    note?: string
  }
  error?: string
}

export interface VideoChainRunResult {
  chainRunId: string
  stages: Record<string, VideoStageRunResult>
}

// 触发视频自动化链（管理员，真实执行）
export function runVideoChain() {
  return request.post<VideoChainRunResult>('/ops/video-automation/run', {}).then((r) => r.data)
}