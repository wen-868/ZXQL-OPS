import request from '@/utils/request'
import type { HumanDriver } from '@/api/analyze'

// ============ R 商品内容中心（products）接口 ============
// 契约见 docs/API接口文档.md 对应章节 /api/ops/products
// 全部按请求头 tenantId 隔离（由 request 拦截器注入）

// 商品来源
export type ProductSourceType = 'system' | 'manual' | 'competitor' | 't_selection'

// 合规风险等级
export type ComplianceRisk = 'none' | 'low' | 'high'

// 内容状态
export type ContentStatus = 'draft' | 'published'

// 内容生成平台
export type ContentPlatform = 'douyin' | 'wechat' | 'xhs' | 'kuaishou'

// ===== 后端视图类型 =====

// 商品视图
export interface ProductView {
  id: number
  sourceType: ProductSourceType
  externalProductId: string | null
  selectionProductId: number | null
  title: string
  stock: number
  price: number | null
  category: string | null
  humanDriver: HumanDriver | null
  createdAt: string
  updatedAt: string
}

// 商品内容视图
export interface ProductContentView {
  id: number
  productId: number
  humanDriver: HumanDriver | null
  titleAi: string | null
  sellingPoint: string | null
  content: Record<string, unknown> | null // 各 section 内容
  script: string | null
  xhsCopy: string | null
  templateId: string | null
  version: number
  complianceRisk: ComplianceRisk
  status: ContentStatus
  createdAt: string
  updatedAt: string
}

// 商品详情页视图
export interface ProductDetailPageView {
  id: number
  productId: number
  sections: Record<string, unknown>[]
  createdAt: string
  updatedAt: string
}

// ===== 入参 DTO 对应 Payload =====

// 录入商品入参
export interface CreateProductPayload {
  sourceType: ProductSourceType
  externalProductId?: string
  selectionProductId?: number
  title?: string
  stock?: number
  price?: number
  category?: string
  humanDriver?: HumanDriver
}

// AI 生成内容入参
export interface GenerateContentPayload {
  humanDriver?: HumanDriver
  platform?: ContentPlatform
}

// 库存调整入参
export interface UpdateStockPayload {
  delta: number
  reason?: string
}

// ===== 接口函数 =====

// 1. 录入商品
export function ingestProduct(payload: CreateProductPayload): Promise<ProductView> {
  return request.post<ProductView>('/ops/products', payload).then((r) => r.data)
}

// 2. 商品库列表（非分页，按 category 过滤）
export function listProducts(category?: string): Promise<ProductView[]> {
  return request
    .get<ProductView[]>('/ops/products', { params: category ? { category } : undefined })
    .then((r) => r.data)
}

// 3. AI 生成内容
export function generateContent(
  id: number,
  payload?: GenerateContentPayload,
): Promise<ProductContentView> {
  return request
    .post<ProductContentView>(`/ops/products/${id}/content/generate`, payload ?? {})
    .then((r) => r.data)
}

// 4. 获取当前内容
export function getContent(id: number): Promise<ProductContentView> {
  return request.get<ProductContentView>(`/ops/products/${id}/content`).then((r) => r.data)
}

// 5. 合规校验
export function checkCompliance(
  id: number,
): Promise<{ risk: ComplianceRisk; hits: string[] }> {
  return request
    .post<{ risk: ComplianceRisk; hits: string[] }>(`/ops/products/${id}/content/check`)
    .then((r) => r.data)
}

// 6. 生成详情页
export function createDetailPage(
  id: number,
  sections?: Record<string, unknown>[],
): Promise<ProductDetailPageView> {
  return request
    .post<ProductDetailPageView>(`/ops/products/${id}/detail-page`, {
      sections: sections ?? [],
    })
    .then((r) => r.data)
}

// 7. 库存调整
export function updateStock(id: number, payload: UpdateStockPayload): Promise<ProductView> {
  return request.patch<ProductView>(`/ops/products/${id}/stock`, payload).then((r) => r.data)
}
