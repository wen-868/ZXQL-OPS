import request from '@/utils/request'

// 系统初始化（设置 → 系统初始化）：部署引导 + 运行期基线数据 seed

export interface SystemStatus {
  initialized: boolean
  adminExists: boolean
  roleCount: number
  complianceWordCount: number
  /** 演示模式是否开启（开启时登录页展示「演示登录」入口） */
  demoMode?: boolean
}

export interface InitStep {
  step: string
  status: 'created' | 'skipped'
  detail?: string
}

export interface InitResult {
  initialized: boolean
  steps: InitStep[]
}

export interface SeedResult {
  steps: InitStep[]
}

export function getSystemStatus() {
  return request.get('/ops/system/status').then((r) => r.data as SystemStatus)
}
export function initSystem(data: {
  tenantId?: string
  adminUsername?: string
  adminPassword?: string
  adminRealName?: string
}) {
  return request.post('/ops/system/init', data).then((r) => r.data as InitResult)
}
export function seedSystem(data: { domains?: string[] }) {
  return request.post('/ops/system/seed', data).then((r) => r.data as SeedResult)
}
