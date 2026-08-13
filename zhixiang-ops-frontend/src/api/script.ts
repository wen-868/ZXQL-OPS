import request from '@/utils/request'

// ============ F 脚本工坊（F-core）接口 ============
// 契约见 docs/API接口文档.md 第四章 F 脚本 /api/ops/script
// 全部按请求头 tenantId 隔离（由 request 拦截器注入）

// 脚本状态机
export type ScriptStatus = 'draft' | 'reviewing' | 'approved' | 'published'

// 合规级别
export type ComplianceLevel = 'none' | 'low' | 'medium' | 'high'

// 合规命中词
export interface ComplianceHit {
  word: string
  position: number
  level: ComplianceLevel
}

// 合规风险
export interface ComplianceRisk {
  hits: ComplianceHit[]
  level: ComplianceLevel
  checkedAt: string
}

// 口播/字幕轨道
export interface TrackItem {
  tsStart: number
  tsEnd: number
  text: string
}

// 脚本
export interface Script {
  id: number
  tenantId: string
  topicId: number
  attributionId: string
  title: string
  content: string
  hook: string
  hookEmotion: string
  spokenTrack?: TrackItem[]
  subtitleTrack?: TrackItem[]
  templateId?: string
  version: number
  parentVersionId?: number
  status: ScriptStatus
  complianceRisk?: ComplianceRisk
  promptVersion: string
  modelUsed: string
  createdAt: string
  updatedAt: string
}

// 脚本模板
export interface ScriptTemplate {
  id: string
  name: string
  structure: string
}

// 生成入参
export interface GenerateScriptPayload {
  topicId: number
  templateId?: string
}

// 生成返回
export interface GenerateScriptResult {
  script: Script
  traceId: string
}

// 列表返回
export interface ScriptListResult {
  list: Script[]
  total: number
  page: number
  pageSize: number
}

// 列表查询参数
export interface ScriptQuery {
  page?: number
  pageSize?: number
  topicId?: number
  status?: string
}

// 更新入参
export interface ScriptUpdatePayload {
  title?: string
  content?: string
  hook?: string
  hookEmotion?: string
  spokenTrack?: TrackItem[]
  subtitleTrack?: TrackItem[]
  templateId?: string
  status?: ScriptStatus
}

// 合规预检入参
export interface ComplianceCheckPayload {
  content?: string
}

// 版本操作入参
export interface VersionScriptPayload {
  action: 'save' | 'rollback'
  content?: string
  spokenTrack?: TrackItem[]
  subtitleTrack?: TrackItem[]
  title?: string
  sourceVersionId?: number
}

// 版本操作返回
export interface VersionScriptResult {
  script: Script
  traceId: string
}

// 模板库返回
export interface TemplateListResult {
  templates: ScriptTemplate[]
}

// ===== 生成脚本 =====
export function generateScript(payload: GenerateScriptPayload) {
  return request.post<GenerateScriptResult>('/ops/script/generate', payload).then((r) => r.data)
}

// ===== 脚本列表 =====
export function listScripts(query: ScriptQuery) {
  return request.get<ScriptListResult>('/ops/script/scripts', { params: query }).then((r) => r.data)
}

// ===== 脚本详情 =====
export function getScript(id: number) {
  return request.get<Script>(`/ops/script/scripts/${id}`).then((r) => r.data)
}

// ===== 更新脚本 =====
export function updateScript(id: number, payload: ScriptUpdatePayload) {
  return request.put<Script>(`/ops/script/scripts/${id}`, payload).then((r) => r.data)
}

// ===== 合规预检 =====
export function checkCompliance(id: number, payload: ComplianceCheckPayload = {}) {
  return request.post<ComplianceRisk>(`/ops/script/scripts/${id}/check`, payload).then((r) => r.data)
}

// ===== 版本操作 =====
export function versionScript(id: number, payload: VersionScriptPayload) {
  return request.post<VersionScriptResult>(`/ops/script/scripts/${id}/version`, payload).then((r) => r.data)
}

// ===== 模板库 =====
export function listTemplates() {
  return request.get<TemplateListResult>('/ops/script/templates').then((r) => r.data)
}
