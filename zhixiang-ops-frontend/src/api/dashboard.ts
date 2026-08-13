import request from '@/utils/request'

export interface DashboardStats {
  accounts: number
  scripts: number
  materials: number
  videos: number
  publishes: number
  topics: number
  intels: number
}

export function getDashboardStats(): Promise<DashboardStats> {
  return request.get('/ops/dashboard/stats').then((r) => r.data)
}

// ============ 决策看板（DashboardView）类型与 API ============

export interface OverviewCards {
  totalPlay: number
  avgCompleteRate: number
  totalInteract: number
  totalFanInc: number
  totalCommission: number
  completeRate: number
  interactRate: number
  fanRate: number
  conversionRate: number
  videoCount: number
}

export interface OverviewView {
  cards: OverviewCards
  trend: Array<{ date: string; play: number; interact: number }>
}

export interface FunnelView {
  stages: Array<{ name: string; value: number }>
  spend: number
  roi: number
}

export interface AccountCompareView {
  accounts: Array<{ accountId: string; nickname: string; platform: string; fansCount: number; publishCount: number; playShare: number }>
  totals: { fansCount: number; publishCount: number; play: number }
}

export interface TopicEfficiencyView {
  items: Array<{ driver: string; emotion: string; topicCount: number; avgScore: number; avgPlay: number; avgConversion: number }>
}

export interface HumanHookView {
  items: Array<{ driver: string; emotion: string; avgConversion: number }>
}

export interface DashboardConfig {
  id: number
  name: string
  widgets: unknown[]
}

export function getOverview(): Promise<OverviewView> {
  return request.get('/ops/dashboard/overview').then((r) => r.data)
}
export function getFunnel(): Promise<FunnelView> {
  return request.get('/ops/dashboard/funnel').then((r) => r.data)
}
export function getAccountCompare(): Promise<AccountCompareView> {
  return request.get('/ops/dashboard/account-compare').then((r) => r.data)
}
export function getTopicEfficiency(): Promise<TopicEfficiencyView> {
  return request.get('/ops/dashboard/topic-efficiency').then((r) => r.data)
}
export function getHumanHook(): Promise<HumanHookView> {
  return request.get('/ops/dashboard/human-hook').then((r) => r.data)
}

export function listDashboards(): Promise<DashboardConfig[]> {
  return request.get('/ops/dashboard/configs').then((r) => r.data)
}
export function createDashboard(data: { name: string; widgets: unknown }): Promise<DashboardConfig> {
  return request.post('/ops/dashboard/configs', data).then((r) => r.data)
}
export function updateDashboard(id: number, data: { name: string; widgets: unknown }): Promise<DashboardConfig> {
  return request.put(`/ops/dashboard/configs/${id}`, data).then((r) => r.data)
}
export function deleteDashboard(id: number): Promise<void> {
  return request.delete(`/ops/dashboard/configs/${id}`).then((r) => r.data)
}
