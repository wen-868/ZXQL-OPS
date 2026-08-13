import request from '@/utils/request'

// N 团队与权限（规划 §4-N / 阶段3 增强）
// 后端 audit/role 控制器直接返回业务结果（未用 ok() 信封），
// 前端拦截器对"非信封"响应直接放行，故统一用 .then(r => r.data) 解包。

export interface PageResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

export interface RoleView {
  id: number
  name: string
  description?: string
  permissions: string[]
  isSystem: boolean
  createdAt: string
  updatedAt: string
}

export interface UserRoleView {
  userId: number
  roles: RoleView[]
  permissions: string[]
}

export interface AuditLogView {
  id: number
  userId?: number
  action: string
  module: string
  resource?: string
  traceId?: string
  ts: string
}

export interface CreateRoleDto {
  name: string
  description?: string
  permissions: string[]
}

export interface UpdateRoleDto {
  name?: string
  description?: string
  permissions?: string[]
}

// 运营系统常用权限点（与后端 n.types COMMON_PERMISSIONS 对齐，文档性常量）
export const COMMON_PERMISSIONS = [
  'account:read',
  'account:write',
  'intel:read',
  'analyze:read',
  'topic:read',
  'topic:write',
  'script:read',
  'script:write',
  'publish:read',
  'publish:write',
  'workflow:read',
  'workflow:write',
  'recycle:read',
  'recycle:write',
  'role:read',
  'role:write',
  'role:manage',
  'audit:read',
]

export function listRoles(params: { page?: number; pageSize?: number }) {
  return request.get('/ops/roles', { params }).then((r) => r.data as PageResult<RoleView>)
}

export function createRole(dto: CreateRoleDto) {
  return request.post('/ops/roles', dto).then((r) => r.data as RoleView)
}

export function getRole(id: number) {
  return request.get<RoleView>(`/ops/roles/${id}`).then((r) => r.data)
}

export function updateRole(id: number, dto: UpdateRoleDto) {
  return request.patch(`/ops/roles/${id}`, dto).then((r) => r.data as RoleView)
}

export function deleteRole(id: number) {
  return request.delete(`/ops/roles/${id}`).then((r) => r.data as { id: number })
}

export function assignRole(id: number, userId: number) {
  return request.post(`/ops/roles/${id}/assign`, { userId }).then((r) => r.data)
}

export function unassignRole(id: number, userId: number) {
  return request.delete(`/ops/roles/${id}/assign/${userId}`).then((r) => r.data)
}

export function getUserRoles(userId: number) {
  return request.get(`/ops/roles/user/${userId}`).then((r) => r.data as UserRoleView)
}

export function queryAudit(params: {
  page?: number
  pageSize?: number
  module?: string
  action?: string
  userId?: number | string
}) {
  return request.get('/ops/audit', { params }).then((r) => r.data as PageResult<AuditLogView>)
}
