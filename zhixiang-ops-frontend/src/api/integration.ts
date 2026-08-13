import request from '@/utils/request'

// 管理系统对接与主数据同步配置（P3 客户自决）

export interface SyncScopes {
  products: boolean
  customers: boolean
  inventory: boolean
  orders: boolean
}

export interface SyncConditions {
  connected: boolean
  serviceAccount: boolean
  tenantBind: boolean
}

export interface SyncConfig {
  mode: 'standalone' | 'connected'
  syncEnabled: boolean
  scopes: SyncScopes
  canSync: boolean
  conditions: SyncConditions
}

/** 获取接入模式、同步开关与可同步条件 */
export function getSyncConfig(): Promise<SyncConfig> {
  return request.get('/ops/integration/config').then((r) => r.data)
}

/** 更新同步开关（开启需满足「同时使用两个系统」条件） */
export function updateSyncConfig(payload: {
  syncEnabled: boolean
  scopes?: Partial<SyncScopes>
}): Promise<SyncConfig> {
  return request.put('/ops/integration/config', payload).then((r) => r.data)
}
