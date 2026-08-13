import request from '@/utils/request'

// ============ S 投流中心（ad）接口 ============
// 契约见 docs/API接口文档.md 对应章节 /api/ops/ad
// 控制器 @Controller('ops/ad')，全部按请求头 tenantId 隔离（由 request 拦截器注入）。
// 注意：后端【无】accounts / campaigns 的列表(GET 列表)端点，也无 GET 单个 account/campaign 端点；
//       仅有 getMetrics / review / smartBid / reportMetric 按 campaignId 操作。
//       前端页面内用本地数组维护本会话创建出来的账户/计划（create 后 push 进本地 ref 用于展示）。

// ============ 类型 ============
export type AdPlatform = 'douyin' | 'wechat' | 'kuaishou'

export type AdAccountType = 'qianchuan' | 'adq' | 'xiaodian_tong'

export type AdAccountStatus = 'active' | 'expired' | 'banned'

export type AdPlanType = 'standard' | 'full_domain' | 'crowd' | 'bid'

export type AdCampaignStatus = 'draft' | 'running' | 'paused' | 'ended'

export interface AdAccountView {
  id: number
  platform: AdPlatform
  type: AdAccountType
  status: AdAccountStatus
  createdAt: string // Date，前端当 string 用 formatDateTime
  updatedAt: string
}

export interface AdCampaignView {
  id: number
  accountId: number
  name: string
  planType: AdPlanType
  audience: Record<string, unknown> | null
  budget: number
  spend: number
  roi: number
  attributionId: string
  status: AdCampaignStatus
  createdAt: string
  updatedAt: string
}

export interface AdMetricView {
  id: number
  campaignId: number
  date: string // 'YYYY-MM-DD'
  impressions: number
  clicks: number
  conversions: number
  cost: number
  roi: number
}

export interface AdReviewView {
  campaignId: number
  attributionId: string
  totalSpend: number
  totalCost: number
  totalConversions: number
  roi: number
  metricsCount: number
}

// ============ 入参 Payload ============
export interface CreateAdAccountPayload {
  platform: AdPlatform // 必填
  type: AdAccountType // 必填
  authEnc?: string
  status?: AdAccountStatus // 默认 'active'
}

export interface CreateCampaignPayload {
  accountId: number // 必填
  name: string // 必填
  planType: AdPlanType // 必填
  audience?: Record<string, unknown>
  budget?: number // ≥0，默认 0
}

export interface SmartBidPayload {
  campaignId?: number // 会被路径 id 覆盖/忽略
  targetRoi?: number // ≥0
  bidAdjust?: number // ≥0
}

export interface ReportMetricPayload {
  campaignId?: number // 会被路径 id 覆盖/忽略
  date?: string
  impressions?: number // ≥0，默认 0
  clicks?: number // ≥0，默认 0
  conversions?: number // ≥0，默认 0
  cost?: number // ≥0，默认 0
  roi?: number // 默认 0
}

// ============ 接口函数 ============
// 1. 创建投放账户
export function createAdAccount(payload: CreateAdAccountPayload): Promise<AdAccountView> {
  return request.post<AdAccountView>('/ops/ad/accounts', payload).then((r) => r.data)
}

// 2. 创建投放计划（会生成 ad 类 attribution_id）
export function createCampaign(payload: CreateCampaignPayload): Promise<AdCampaignView> {
  return request.post<AdCampaignView>('/ops/ad/campaigns', payload).then((r) => r.data)
}

// 3. 实时监控（聚合最新一条指标；无数据返回 null）
export function getMetrics(id: number): Promise<AdMetricView | null> {
  return request.get<AdMetricView | null>(`/ops/ad/campaigns/${id}/metrics`).then((r) => r.data)
}

// 4. 智能出价（仅产出建议，不改平台出价）
export function smartBid(id: number, payload: SmartBidPayload): Promise<{ suggestion: string }> {
  return request
    .post<{ suggestion: string }>(`/ops/ad/campaigns/${id}/smart-bid`, payload)
    .then((r) => r.data)
}

// 5. 复盘（聚合指标 + 透传 attribution_id）
export function review(id: number): Promise<AdReviewView> {
  return request.get<AdReviewView>(`/ops/ad/campaigns/${id}/review`).then((r) => r.data)
}

// 6. 指标上报（回写 plan spend/roi；可选字段后端给 0）
export function reportMetric(id: number, payload: ReportMetricPayload): Promise<AdMetricView> {
  return request
    .post<AdMetricView>(`/ops/ad/campaigns/${id}/metrics`, payload)
    .then((r) => r.data)
}
