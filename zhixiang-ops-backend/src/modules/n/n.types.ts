/**
 * N 团队与权限：类型与常量。
 * 权限点（permission point）为 `module:action` 形式的字符串，
 * 由各业务模块自定义；下方为运营系统常用权限点参考清单（非强制枚举）。
 */

/** 运营系统常用权限点（文档性常量，供各模块与前端对齐） */
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
] as const;

export type PermissionPoint = (typeof COMMON_PERMISSIONS)[number];

/** 角色视图（剥离实体元数据，供响应信封使用） */
export interface RoleView {
  id: number;
  name: string;
  description?: string;
  permissions: string[];
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** 用户角色视图（含合并后的权限集合） */
export interface UserRoleView {
  userId: number;
  roles: RoleView[];
  permissions: string[];
}

/** 审计记录视图 */
export interface AuditLogView {
  id: number;
  userId?: number;
  action: string;
  module: string;
  resource?: string;
  traceId?: string;
  ts: Date;
}
