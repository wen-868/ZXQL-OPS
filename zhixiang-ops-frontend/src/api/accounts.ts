import request from '@/utils/request'

// ============ B 账号矩阵（B-core）接口 ============
// 契约见 docs/API接口文档.md 第二章 B 账号矩阵 /api/ops/accounts
// 注意：health/summary 须声明在 /:id 之前（路由顺序）

// 枚举取值
export type Platform =
  | 'douyin'
  | 'kuaishou'
  | 'xiaohongshu'
  | 'bilibili'
  | 'wechat-channels'
export type Identity = 'primary' | 'secondary' | 'matrix'
export type Stage = 'nurturing' | 'growing' | 'mature' | 'declining'
export type AccountStatus =
  | 'normal'
  | 'warning'
  | 'risk'
  | 'unsigned'
  | 'banned'

// 账号响应对象（已剥离 token 密文）
export interface AccountView {
  id: number
  tenantId: string
  platform: Platform
  platformAccountId: string
  nickname?: string
  avatarUrl?: string
  identity?: Identity
  track?: string
  stage?: Stage
  status: AccountStatus
  tokenExpireAt?: string
  lastSyncAt?: string
  lastActiveAt?: string
  fansCount: number
  followCount: number
  likeCount: number
  remark?: string
  createdAt: string
  updatedAt: string
}

// 列表查询参数
export interface AccountQuery {
  platform?: Platform
  identity?: Identity
  stage?: Stage
  status?: AccountStatus
  keyword?: string
  page?: number
  pageSize?: number
}

// 分页响应
export interface PagedResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

// 创建/编辑入参（含明文 token，响应不回传）
export interface AccountPayload {
  platform: Platform
  platformAccountId: string
  nickname?: string
  avatarUrl?: string
  identity?: Identity
  track?: string
  stage?: Stage
  accessToken?: string
  refreshToken?: string
  tokenExpireAt?: string
  fansCount?: number
  followCount?: number
  likeCount?: number
  remark?: string
}

// 矩阵健康看板
export interface HealthSummary {
  total: number
  byStatus: Partial<Record<AccountStatus, number>>
  byPlatform: Partial<Record<Platform, number>>
  unsignedAccounts: { id: number; nickname?: string; platform: Platform }[]
}

// 列表（分页 + 筛选）
export function listAccounts(query: AccountQuery) {
  return request
    .get<PagedResult<AccountView>>('/ops/accounts', { params: query })
    .then((r) => r.data)
}

// 矩阵健康看板（须声明在 /:id 之前）
export function getHealthSummary() {
  return request.get<HealthSummary>('/ops/accounts/health/summary').then((r) => r.data)
}

// 详情
export function getAccount(id: number) {
  return request.get<AccountView>(`/ops/accounts/${id}`).then((r) => r.data)
}

// 新建（含明文 token，提示服务端加密）
export function createAccount(payload: AccountPayload) {
  return request.post<AccountView>('/ops/accounts', payload).then((r) => r.data)
}

// 局部更新
export function updateAccount(id: number, payload: Partial<AccountPayload>) {
  return request.patch<AccountView>(`/ops/accounts/${id}`, payload).then((r) => r.data)
}

// 删除（软删）
export function deleteAccount(id: number) {
  return request.delete<{ id: number }>(`/ops/accounts/${id}`).then((r) => r.data)
}
