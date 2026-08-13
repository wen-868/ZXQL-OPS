import request from '@/utils/request'
import type { PageResult } from '@/api/team'

// 员工管理（设置 → 员工管理）：复用登录用户表 + RBAC 角色

export interface RoleBasic {
  id: number
  name: string
}
export interface RoleOption {
  id: number
  name: string
  description: string | null
  isSystem: boolean
}
export interface Employee {
  id: number
  username: string
  realName: string | null
  role: string
  type: string
  status: number
  tenantId: string
  createdAt: string
  updatedAt: string
  roles: RoleBasic[]
}
export interface EmployeeQuery {
  page?: number
  pageSize?: number
  keyword?: string
  status?: number
}

export function listEmployees(params: EmployeeQuery) {
  return request.get('/ops/employees', { params }).then((r) => r.data as PageResult<Employee>)
}
export function listRoleOptions() {
  return request.get('/ops/employees/roles').then((r) => r.data as RoleOption[])
}
export function getEmployee(id: number) {
  return request.get(`/ops/employees/${id}`).then((r) => r.data as Employee & { roles: RoleBasic[] })
}
export function createEmployee(data: {
  username: string
  password: string
  realName?: string
  role?: string
  status?: number
}) {
  return request.post('/ops/employees', data).then((r) => r.data as Employee)
}
export function updateEmployee(
  id: number,
  data: { realName?: string; role?: string; status?: number; password?: string },
) {
  return request.put(`/ops/employees/${id}`, data).then((r) => r.data as Employee)
}
export function deleteEmployee(id: number) {
  return request.delete(`/ops/employees/${id}`).then((r) => r.data as { id: number })
}
export function getEmployeeRoles(id: number) {
  return request.get(`/ops/employees/${id}/roles`).then((r) => r.data as { userId: number; roles: RoleBasic[] })
}
export function assignEmployeeRole(id: number, roleId: number) {
  return request.post(`/ops/employees/${id}/roles`, { roleId }).then((r) => r.data)
}
export function unassignEmployeeRole(id: number, roleId: number) {
  return request.delete(`/ops/employees/${id}/roles/${roleId}`).then((r) => r.data)
}
