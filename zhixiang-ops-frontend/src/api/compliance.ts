import request from '@/utils/request'
import type { PageResult } from '@/api/team'

// P 合规预检（规划 §4-P / 阶段2 商业化）

export type ComplianceWordLevel = 'low' | 'medium' | 'high'
export type ComplianceWordAction = 'pass' | 'warn' | 'block'
export type ComplianceLevel = 'none' | 'low' | 'medium' | 'high'
export type ComplianceResult = 'pass' | 'warn' | 'block'

export interface ComplianceHit {
  word: string
  position: number
  level: ComplianceWordLevel
}

export interface ComplianceCheckResult {
  hits: ComplianceHit[]
  level: ComplianceLevel
  score: number
  result: ComplianceResult
}

export interface ComplianceWord {
  id: number
  word: string
  category: string
  level: ComplianceWordLevel
  action: ComplianceWordAction
  enabled: boolean
}

export interface ComplianceLog {
  id: number
  scene: string
  sourceId?: number | null
  text?: string
  hits: ComplianceHit[]
  level: string
  score: number
  result: string
  createdAt: string
}

export interface AddWordDto {
  word: string
  category?: string
  level?: ComplianceWordLevel
  action?: ComplianceWordAction
  enabled?: boolean
}

export interface UpdateWordDto {
  word?: string
  category?: string
  level?: ComplianceWordLevel
  action?: ComplianceWordAction
  enabled?: boolean
}

export function checkText(text: string, scene?: string) {
  return request
    .post('/ops/compliance/check', { text, scene })
    .then((r) => r.data as ComplianceCheckResult)
}
export function queryWords(params: { page?: number; pageSize?: number; level?: string; category?: string }) {
  return request.get('/ops/compliance/words', { params }).then((r) => r.data as PageResult<ComplianceWord>)
}
export function addWord(dto: AddWordDto) {
  return request.post('/ops/compliance/words', dto).then((r) => r.data as ComplianceWord)
}
export function updateWord(id: number, dto: UpdateWordDto) {
  return request.put(`/ops/compliance/words/${id}`, dto).then((r) => r.data as ComplianceWord)
}
export function removeWord(id: number) {
  return request.delete(`/ops/compliance/words/${id}`).then((r) => r.data as { id: number })
}
export function queryLogs(params: { page?: number; pageSize?: number; scene?: string; result?: string }) {
  return request.get('/ops/compliance/logs', { params }).then((r) => r.data as PageResult<ComplianceLog>)
}
