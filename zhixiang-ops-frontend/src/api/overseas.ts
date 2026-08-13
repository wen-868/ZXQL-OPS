import request from '@/utils/request'
import type { PageResult } from '@/api/team'

// X 内容出海（规划 §4-X / 阶段3 增强）

export type OverseasVideoStatus = 'draft' | 'translating' | 'published' | 'failed'
export type TranslationTaskStatus = 'queued' | 'translating' | 'done' | 'failed'

export interface OverseasPlatform {
  id: number
  tenantId: string
  code: string
  name: string
  region?: string
  baseLang?: string
  meta?: Record<string, unknown>
}

export interface OverseasVideo {
  id: number
  tenantId: string
  sourceVideoId: number
  platformId: number
  title?: string
  targetLang: string
  status: OverseasVideoStatus
  url?: string
  meta?: Record<string, unknown>
}

export interface TranslationTask {
  id: number
  tenantId: string
  videoId: number
  sourceLang?: string
  targetLang: string
  sourceText?: string
  translatedScript?: string
  status: TranslationTaskStatus
  meta?: Record<string, unknown>
}

export interface OverseasSummary {
  platformCount: number
  videoCount: number
  publishedCount: number
  taskCount: number
  byStatus: Record<string, number>
}

export interface CreatePlatformDto {
  code: string
  name: string
  region?: string
  baseLang?: string
  meta?: Record<string, unknown>
}

export interface CreateVideoDto {
  sourceVideoId: number
  platformId: number
  title?: string
  targetLang: string
  status?: OverseasVideoStatus
  meta?: Record<string, unknown>
}

export interface UpdateVideoDto {
  title?: string
  status?: OverseasVideoStatus
  url?: string
  meta?: Record<string, unknown>
}

export interface CreateTaskDto {
  videoId: number
  sourceLang?: string
  targetLang: string
  sourceText?: string
}

export function listPlatforms() {
  return request.get('/ops/overseas/platforms').then((r) => r.data as OverseasPlatform[])
}
export function createPlatform(dto: CreatePlatformDto) {
  return request.post('/ops/overseas/platforms', dto).then((r) => r.data as OverseasPlatform)
}
export function listVideos(params: { page?: number; pageSize?: number; status?: string }) {
  return request.get('/ops/overseas/videos', { params }).then((r) => r.data as PageResult<OverseasVideo>)
}
export function createVideo(dto: CreateVideoDto) {
  return request.post('/ops/overseas/videos', dto).then((r) => r.data as OverseasVideo)
}
export function updateVideo(id: number, dto: UpdateVideoDto) {
  return request.put(`/ops/overseas/videos/${id}`, dto).then((r) => r.data as OverseasVideo)
}
export function listTasks(params: { page?: number; pageSize?: number }) {
  return request.get('/ops/overseas/tasks', { params }).then((r) => r.data as PageResult<TranslationTask>)
}
export function createTask(dto: CreateTaskDto) {
  return request.post('/ops/overseas/tasks', dto).then((r) => r.data as TranslationTask)
}
export function getSummary() {
  return request.get('/ops/overseas/summary').then((r) => r.data as OverseasSummary)
}
