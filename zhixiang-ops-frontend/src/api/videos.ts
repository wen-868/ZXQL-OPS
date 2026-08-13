import request from '@/utils/request'

// ============ H 智能成片（H-core）接口 ============
// 契约见 docs/API接口文档.md 第四章 H 成片 /api/ops/videos
// 全部按请求头 tenantId 隔离（由 request 拦截器注入）

// 成片状态
export type VideoStatus = 'draft' | 'editing' | 'done'

// 送审状态
export type ReviewStatus = 'pending' | 'reviewing' | 'passed' | 'rejected'

// 成片视图
export interface VideoView {
  id: number
  scriptId: number | null
  materialIds: number[] | null
  ratio: string | null
  duration: number | null
  url: string | null
  reviewStatus: ReviewStatus
  status: VideoStatus
  title: string | null
  meta: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

// 脚本转成片入参
export interface FromScriptPayload {
  scriptId: number
  materialIds?: number[]
  ratio?: string
  title?: string
}

// 成片编辑入参
export interface EditVideoPayload {
  materialIds?: number[]
  ratio?: string
}

// ===== 脚本转分镜+成片 =====
export function fromScript(payload: FromScriptPayload) {
  return request.post<VideoView>('/ops/videos/from-script', payload).then((r) => r.data)
}

// ===== 成片编辑（AI 自动剪辑/模板化）=====
export function editVideo(id: number, payload: EditVideoPayload) {
  return request.post<VideoView>(`/ops/videos/${id}/edit`, payload).then((r) => r.data)
}

// ===== 送审 + 合规预检 =====
export function reviewVideo(id: number) {
  return request.post<VideoView>(`/ops/videos/${id}/review`).then((r) => r.data)
}

// ===== 视频库 =====
export function listVideos() {
  return request.get<VideoView[]>('/ops/videos').then((r) => r.data)
}
