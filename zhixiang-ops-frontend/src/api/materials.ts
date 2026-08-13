import request from '@/utils/request'

// ============ G 素材中心（G-core）接口 ============
// 契约见 docs/API接口文档.md 第四章 G 素材 /api/ops/materials
// 全部按请求头 tenantId 隔离（由 request 拦截器注入）

// 素材类型
export type MaterialType = 'image' | 'video' | 'music' | 'subtitle' | 'sticker' | 'avatar'

// 素材来源
export type MaterialSource = 'jimeng' | 'keling' | 'local' | 'upload'

// 素材状态
export type MaterialStatus = 'pending' | 'generated' | 'uploaded' | 'failed'

// 素材视图
export interface MaterialView {
  id: number
  type: MaterialType
  source: MaterialSource
  url: string | null
  ratio: string | null
  tags: string[] | null
  relatedScriptId: number | null
  status: MaterialStatus
  meta: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

// 列表返回
export interface MaterialListResult {
  list: MaterialView[]
  total?: number
  page?: number
  pageSize?: number
}

// 列表查询参数
export interface MaterialQuery {
  tag?: string
  type?: MaterialType
}

// AI 生成入参
export interface GenerateMaterialPayload {
  type: 'image' | 'video'
  source: 'jimeng' | 'keling' | 'local'
  prompt: string
  relatedScriptId?: number
  ratio?: string
}

// 实拍上传入参
export interface UploadMaterialPayload {
  type: MaterialType
  source: 'upload'
  url: string
  relatedScriptId?: number
  ratio?: string
  tags?: string[]
}

// 追加标签入参
export interface TagMaterialPayload {
  tags: string[]
}

// ===== AI 画面/视频生成 =====
export function generateMaterial(payload: GenerateMaterialPayload) {
  return request.post<MaterialView>('/ops/materials/generate', payload).then((r) => r.data)
}

// ===== 实拍上传 =====
export function uploadMaterial(payload: UploadMaterialPayload) {
  return request.post<MaterialView>('/ops/materials/upload', payload).then((r) => r.data)
}

// ===== 素材库 =====
export function listMaterials(query: MaterialQuery = {}) {
  return request.get<MaterialListResult>('/ops/materials', { params: query }).then((r) => r.data)
}

// ===== 追加标签 =====
export function addTag(id: number, payload: TagMaterialPayload) {
  return request.post<MaterialView>(`/ops/materials/${id}/tag`, payload).then((r) => r.data)
}
