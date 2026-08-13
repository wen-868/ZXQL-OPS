import request from '@/utils/request'

// ============ U 私域中心（private）接口 ============
// 契约见 docs/API接口文档.md 对应章节 /api/ops （控制器 @Controller('ops')）
// 注意：控制器前缀是 `ops`，不是 `ops/private`。全部按请求头 tenantId 隔离（由 request 拦截器注入）。
// 关键差异（与 S 模块不同）：
//   - 粉丝画像【有】GET /ops/fans 列表端点，前端应直接调 listFans 拉取并展示（创建/打标后刷新列表）。
//   - 私域群【无】list 端点（仅 createGroup + pushGroup 按 id 操作），因此群列表必须用本地 ref 数组维护
//     （createGroup 后 push 返回值）。这是后端契约的客观限制，已在该组件注释说明。

// ============ 类型 ============
export type FansSource = 'aggregate' | 'authorized' | 'public'

export type PrivateGroupType = 'wecom' | 'wechat'

export interface FansProfileView {
  id: number
  platform: string
  publicId: string
  level: string
  interactAgg: Record<string, unknown> | null
  tags: string[] | null
  source: FansSource
  createdAt: string // Date，前端当 string 用 formatDateTime
  updatedAt: string
}

export interface PrivateGroupView {
  id: number
  name: string
  members: string[]
  type: PrivateGroupType
  createdAt: string
  updatedAt: string
}

// ============ 入参 Payload ============
export interface UpsertFansPayload {
  platform: string // 必填
  publicId: string // 必填，平台公开ID，禁止个体隐私字段
  level?: string // 可选，默认 'normal'
  interactAgg?: Record<string, unknown> // 可选，聚合交互分布对象
  tags?: string[] // 可选
  source?: FansSource // 可选，IsIn
}

export interface TagFansPayload {
  id: number // 必填
  tags: string[] // 必填
}

export interface CreateGroupPayload {
  name: string // 必填
  type?: PrivateGroupType // 可选，IsIn，默认 'wecom'
  members?: string[] // 可选，仅公开ID
}

export interface DistributePayload {
  publicIds: string[] // 必填
  planName: string // 必填
  tierCommission: number // 必填，≥0
}

export interface RepurchasePayload {
  publicId: string // 必填
  products?: string[] // 可选
  amount?: number // 可选，≥0，默认 0
}

// ============ 接口函数 ============
// 1. 创建/更新粉丝画像（upsert，按 tenantId+platform+publicId 唯一）
export function upsertFans(payload: UpsertFansPayload): Promise<FansProfileView> {
  return request.post<FansProfileView>('/ops/fans', payload).then((r) => r.data)
}

// 2. 粉丝画像列表（有列表端点，可直接拉取展示）
export function listFans(platform?: string): Promise<FansProfileView[]> {
  return request
    .get<FansProfileView[]>('/ops/fans', { params: platform ? { platform } : undefined })
    .then((r) => r.data)
}

// 3. 粉丝分层打标
export function tagFans(payload: TagFansPayload): Promise<FansProfileView> {
  return request.post<FansProfileView>('/ops/fans/tags', payload).then((r) => r.data)
}

// 4. 创建私域群
export function createGroup(payload: CreateGroupPayload): Promise<PrivateGroupView> {
  return request.post<PrivateGroupView>('/ops/private-groups', payload).then((r) => r.data)
}

// 5. 私域群触达（= 群内 members 数量）
export function pushGroup(id: number): Promise<{ pushed: number }> {
  return request
    .post<{ pushed: number }>(`/ops/private-groups/${id}/push`)
    .then((r) => r.data)
}

// 6. 推客分销（分级佣金）
export function distribute(
  payload: DistributePayload,
): Promise<{ planName: string; tiers: number; commission: number }> {
  return request
    .post<{ planName: string; tiers: number; commission: number }>('/ops/fans/distribute', payload)
    .then((r) => r.data)
}

// 7. 复购 CRM
export function repurchase(
  payload: RepurchasePayload,
): Promise<{ publicId: string; amount: number }> {
  return request
    .post<{ publicId: string; amount: number }>('/ops/fans/repurchase', payload)
    .then((r) => r.data)
}
