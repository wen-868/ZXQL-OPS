import request from '@/utils/request'
import type { HumanDriver } from '@/api/analyze'

// ============ T 选品中心（selection）接口 ============
// 契约见 docs/API接口文档.md 对应章节 /api/ops/selection
// 全部按请求头 tenantId 隔离（由 request 拦截器注入）

// 选品来源
export type SelectionSource = 'manual' | 'connected' | 'competitor'

// 单条选品录入项（导入/手动）
export interface SelectionImportItem {
  title: string
  commissionRate?: number
  reputationScore?: number
  sales30d?: number
  price?: number
  category?: string
  humanDriver?: HumanDriver | null
  platform?: string
  externalProductId?: string
}

// 导入选品入参
export interface ImportSelectionPayload {
  source: SelectionSource
  platform?: string
  ids?: string[]
  products?: SelectionImportItem[]
}

// 选品库视图
export interface SelectionProductView {
  id: number
  source: SelectionSource
  platform: string | null
  externalProductId: string | null
  title: string
  commissionRate: number
  reputationScore: number | null
  sales30d: number
  price: number | null
  category: string | null
  humanDriver: HumanDriver | null
  metrics?: Record<string, unknown> | null
  collectedAt: string | null
  createdAt: string
  updatedAt: string
}

// 选品清单视图
export interface SelectionListView {
  id: number
  name: string
  items: number[]
  itemCount: number
  createdAt: string
  updatedAt: string
}

// 选品清单详情（展开选品）
export interface SelectionListDetail extends SelectionListView {
  products: SelectionProductView[]
}

// 榜单项
export interface HotItem {
  id: number
  title: string
  commissionRate: number
  reputationScore: number | null
  sales30d: number
  humanDriver: HumanDriver | null
}

// 蓝海词项
export interface BlueOceanItem {
  category: string
  avgCommissionRate: number
  avgSales30d: number
  score: number
}

// 选品库筛选入参
export interface SelectionFilterPayload {
  commissionRateMin?: number
  reputationMin?: number
  salesMin?: number
  category?: string
  humanDriver?: HumanDriver | null
  keyword?: string
  page?: number
  pageSize?: number
}

// 选品库筛选返回
export interface SelectionPageResult {
  list: SelectionProductView[]
  total: number
  page: number
  pageSize: number
}

// 榜单返回
export interface HotResult {
  surging: HotItem[]
  darkHorse: HotItem[]
}

// ===== 导入选品 =====
export function importSelection(payload: ImportSelectionPayload) {
  return request.post<SelectionProductView[]>('/ops/selection/import', payload).then((r) => r.data)
}

// ===== 选品库筛选 =====
export function querySelection(filter: SelectionFilterPayload) {
  return request
    .get<SelectionPageResult>('/ops/selection', { params: filter })
    .then((r) => r.data)
}

// ===== 榜单 =====
export function getHot() {
  return request.get<HotResult>('/ops/selection/hot').then((r) => r.data)
}

// ===== 蓝海词 =====
export function getBlueOcean() {
  return request.get<BlueOceanItem[]>('/ops/selection/blue-ocean').then((r) => r.data)
}

// ===== 新建选品清单 =====
export function createList(payload: { name: string; items?: number[] }) {
  return request.post<SelectionListView>('/ops/selection/lists', payload).then((r) => r.data)
}

// ===== 选品清单列表 =====
export function getLists() {
  return request.get<SelectionListView[]>('/ops/selection/lists').then((r) => r.data)
}

// ===== 选品清单详情 =====
export function getList(id: number) {
  return request.get<SelectionListDetail>(`/ops/selection/lists/${id}`).then((r) => r.data)
}

// ===== 删除选品清单 =====
export function removeList(id: number) {
  return request.delete<{ id: number }>(`/ops/selection/lists/${id}`).then((r) => r.data)
}
