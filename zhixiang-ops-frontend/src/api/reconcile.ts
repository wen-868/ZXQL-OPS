import request from '@/utils/request'

// W 收益与对账（规划 §4-W，路由前缀 /api/ops）
// 注意：响应拦截器已把 response.data 改写为业务 data，调用方 .then(r => r.data) 直接得业务 T。
// 类型以 src/modules/w/w.types.ts 为准。

export type RevenueSource = 'commission' | 'slot_fee' | 'service_fee' | 'tip' | 'subsidy'
export type RevenueStatus = 'pending' | 'settled'
export type ReconciliationStatus = 'pending' | 'matched' | 'diff_found'
export type SettlementType = 'org_talent_advertiser'
export type SettlementStatus = 'pending' | 'settled' | 'invoiced'

export interface RevenueRecordView {
  id: number
  source: RevenueSource
  platform: string
  amount: number
  relatedOrderId: string | null
  commission: number
  status: RevenueStatus
  createdAt: string
  updatedAt: string
}

export interface RevenueSummaryItem {
  source: RevenueSource
  total: number
  count: number
}

export interface RevenueListView {
  summary: RevenueSummaryItem[]
  items: RevenueRecordView[]
}

export interface ReconciliationView {
  id: number
  period: string
  orderAmount: number
  commissionAmount: number
  settledAmount: number
  diff: number
  status: ReconciliationStatus
  createdAt: string
  updatedAt: string
}

export interface SettlementPartyView {
  role: string // org/talent/ad_operator
  name: string
  amount: number
}

export interface SettlementView {
  id: number
  type: SettlementType
  parties: SettlementPartyView[]
  amount: number
  status: SettlementStatus
  createdAt: string
  updatedAt: string
}

export interface ProfitView {
  totalRevenue: number
  totalCommission: number
  totalAdCost: number
  netProfit: number
}

export function recordRevenue(dto: {
  source: RevenueSource
  platform: string
  amount: number
  relatedOrderId?: string
  commission?: number
  status?: RevenueStatus
}): Promise<RevenueRecordView> {
  return request.post<RevenueRecordView>('/ops/revenue', dto).then((r) => r.data)
}

export function listRevenue(source?: RevenueSource): Promise<RevenueListView> {
  return request
    .get<RevenueListView>('/ops/revenue', { params: source ? { source } : {} })
    .then((r) => r.data)
}

export function reconcile(period: string): Promise<ReconciliationView> {
  return request.post<ReconciliationView>('/ops/reconciliation', { period }).then((r) => r.data)
}

export function getReconciliation(id: number): Promise<ReconciliationView> {
  return request.get<ReconciliationView>(`/ops/reconciliation/${id}`).then((r) => r.data)
}

export function settle(dto: {
  type: SettlementType
  parties: { role: string; name: string; amount: number }[]
  amount: number
  status?: SettlementStatus
}): Promise<SettlementView> {
  return request.post<SettlementView>('/ops/settlement', dto).then((r) => r.data)
}

export function invoice(settlementId: number): Promise<SettlementView> {
  return request.post<SettlementView>(`/ops/settlement/${settlementId}/invoice`).then((r) => r.data)
}

export function profit(): Promise<ProfitView> {
  return request.get<ProfitView>('/ops/profit').then((r) => r.data)
}
