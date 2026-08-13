import request from '@/utils/request'
import type { PageResult } from '@/api/team'

// 大模型配置（设置 → 大模型配置）

export type LlmType = 'ollama' | 'openai' | 'azure' | 'custom'

export interface LlmProvider {
  id: number
  name: string
  type: LlmType
  baseUrl: string | null
  defaultModel: string | null
  enabled: boolean
  remark: string | null
  /** '******' 已配置，'' 未配置 */
  apiKeyMasked: string
  createdAt: string
  updatedAt: string
}

export interface LlmQuery {
  page?: number
  pageSize?: number
  type?: LlmType
  enabled?: number
  keyword?: string
}

export function listProviders(params: LlmQuery) {
  return request.get('/ops/llm', { params }).then((r) => r.data as PageResult<LlmProvider>)
}
export function createProvider(data: {
  name: string
  type: LlmType
  baseUrl?: string
  apiKey?: string
  defaultModel?: string
  enabled?: boolean
  remark?: string
}) {
  return request.post('/ops/llm', data).then((r) => r.data as LlmProvider)
}
export function updateProvider(
  id: number,
  data: {
    name?: string
    type?: LlmType
    baseUrl?: string
    apiKey?: string
    defaultModel?: string
    enabled?: boolean
    remark?: string
  },
) {
  return request.put(`/ops/llm/${id}`, data).then((r) => r.data as LlmProvider)
}
export function deleteProvider(id: number) {
  return request.delete(`/ops/llm/${id}`).then((r) => r.data as { id: number })
}
export function testProvider(id: number) {
  return request.post(`/ops/llm/${id}/test`).then((r) => r.data as { ok: boolean; message: string })
}
