import request from '@/utils/request'

// Y 订单物流（规划 §4-Y，路由前缀 /api/ops）
// 注意：响应拦截器已把 response.data 改写为业务 data，调用方 .then(r => r.data) 直接得业务 T。
// 类型以 src/modules/y/y.types.ts 为准。

export type OrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'shipped'
  | 'completed'
  | 'refunded'
export type LogisticsStatus = 'pending' | 'shipped' | 'in_transit' | 'delivered' | 'exception'

export interface BuyerView {
  name?: string
  phone?: string
  address?: string
  buyerRef?: string
}

export interface OrderView {
  id: number
  source: string
  platform: string
  orderId: string
  productId?: number
  quantity: number
  amount: number
  commission: number
  status: OrderStatus
  logisticsStatus: LogisticsStatus
  attributionId?: string
  buyer: BuyerView | null
  createdAt: string
  updatedAt: string
}

export interface LogisticsTrackNode {
  node: string
  ts?: string
  carrier?: string
  trackingNo?: string
  status?: string
}

export interface WaybillView {
  id: number
  orderId: number
  carrier?: string
  trackingNo?: string
  printStatus?: string
  printedAt?: string
  createdAt: string
  updatedAt: string
}

export interface InventoryWarnItem {
  id: number
  title: string
  stock: number
}

export interface SyncOrderResult {
  total: number
  created: number
  updated: number
}

export function syncOrders(dto: {
  source?: 'management' | 'platform'
  orders: {
    orderId: string
    platform: string
    productId?: number
    quantity?: number
    amount: number
    commission?: number
    status?: OrderStatus
    attributionId?: string
    buyer?: { name: string; phone: string; address: string; buyerRef?: string }
  }[]
}): Promise<SyncOrderResult> {
  return request.post<SyncOrderResult>('/ops/orders/sync', dto).then((r) => r.data)
}

export function listOrders(params?: { status?: OrderStatus; platform?: string }): Promise<OrderView[]> {
  return request.get<OrderView[]>('/ops/orders', { params }).then((r) => r.data)
}

export function getOrder(id: number): Promise<OrderView> {
  return request.get<OrderView>(`/ops/orders/${id}`).then((r) => r.data)
}

export function refundOrder(id: number): Promise<OrderView> {
  return request.post<OrderView>(`/ops/orders/${id}/refund`).then((r) => r.data)
}

export function getTrack(orderId: number): Promise<LogisticsTrackNode[]> {
  return request.get<LogisticsTrackNode[]>(`/ops/logistics/${orderId}/track`).then((r) => r.data)
}

export function createWaybill(id: number, carrier?: string): Promise<WaybillView> {
  return request
    .post<WaybillView>(`/ops/orders/${id}/waybill`, carrier ? { carrier } : {})
    .then((r) => r.data)
}

export function batchWaybill(orderIds: number[], carrier?: string): Promise<{ count: number }> {
  return request
    .post<{ count: number }>('/ops/orders/batch-waybill', { orderIds, carrier })
    .then((r) => r.data)
}

export function syncInventory(dto: { productId: number; delta: number; reason?: string }): Promise<{ productId: number; stock: number }> {
  return request.post<{ productId: number; stock: number }>('/ops/inventory/sync', dto).then((r) => r.data)
}

export function inventoryWarn(threshold?: number): Promise<InventoryWarnItem[]> {
  return request
    .get<InventoryWarnItem[]>('/ops/inventory/warn', { params: threshold != null ? { threshold } : {} })
    .then((r) => r.data)
}
