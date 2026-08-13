import request from '@/utils/request'

// ============ K 直播中心（live）接口 ============
// 契约见 docs/API接口文档.md 对应章节 /api/ops/live
// 全部按请求头 tenantId 隔离（由 request 拦截器注入）
// 注意：后端【无】rooms / digital-humans 的列表(GET 列表)端点，也无 GET 所有数字接口；
//       前端页面内用本地数组维护本会话创建出来的直播间/数字人（create 后 push 进本地 ref）。
//       可调用：getRoom / getStats / start / end / push / reportStat。

// ============ 类型 ============
export type LiveRoomType = 'real' | 'digital'

export type LiveRoomStatus = 'created' | 'live' | 'ended'

export type LiveAiReplyStatus = 'auto' | 'pending'

export interface LiveRoomView {
  id: number
  type: LiveRoomType
  platform: string
  accountId: number
  rtmpUrl: string | null
  status: LiveRoomStatus
  title: string | null
  productIds: number[]
  attributionId: string
  startedAt: string | null // Date，前端当 string 用 formatDateTime
  endedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface DigitalHumanView {
  id: number
  name: string
  avatar: string | null
  voice: string | null
  status: string
  createdAt: string
  updatedAt: string
}

export interface LiveAiReplyView {
  id: number
  roomId: number
  question: string
  answer: string | null
  status: LiveAiReplyStatus
}

export interface LiveStatView {
  id: number
  roomId: number
  onlineCount: number
  gmv: number
  attributionId: string
  ts: string
}

// ============ 入参 Payload ============
export interface CreateRoomPayload {
  type: LiveRoomType // 必填
  platform: string // 必填
  accountId: number // 必填
  title?: string
  productIds?: number[]
}

export interface ReportStatPayload {
  onlineCount?: number // ≥0，默认 0
  gmv?: number // ≥0，默认 0
  ts?: string
}

export interface CreateDigitalHumanPayload {
  name: string // 必填
  avatar?: string
  voice?: string
  status?: string // 默认 'active'
}

export interface DanmuAiReplyPayload {
  roomId: number // 必填
  question: string // 必填
  status?: LiveAiReplyStatus // 默认 'auto'
}

// ============ 接口函数 ============
// 1. 创建直播间
export function createRoom(payload: CreateRoomPayload): Promise<LiveRoomView> {
  return request.post<LiveRoomView>('/ops/live/rooms', payload).then((r) => r.data)
}

// 2. 获取直播间
export function getRoom(id: number): Promise<LiveRoomView> {
  return request.get<LiveRoomView>(`/ops/live/rooms/${id}`).then((r) => r.data)
}

// 3. 开播（created→live）
export function startRoom(id: number): Promise<LiveRoomView> {
  return request.post<LiveRoomView>(`/ops/live/rooms/${id}/start`).then((r) => r.data)
}

// 4. 结束（live→ended）
export function endRoom(id: number): Promise<LiveRoomView> {
  return request.post<LiveRoomView>(`/ops/live/rooms/${id}/end`).then((r) => r.data)
}

// 5. 推流（请求体 { rtmpUrl }）
export function pushStream(id: number, rtmpUrl: string): Promise<LiveRoomView> {
  return request
    .post<LiveRoomView>(`/ops/live/rooms/${id}/push`, { rtmpUrl })
    .then((r) => r.data)
}

// 6. 最新一条监控数据（无数据返回 null）
export function getStats(id: number): Promise<LiveStatView | null> {
  return request.get<LiveStatView | null>(`/ops/live/rooms/${id}/stats`).then((r) => r.data)
}

// 7. 上报统计
export function reportStat(id: number, payload: ReportStatPayload): Promise<LiveStatView> {
  return request
    .post<LiveStatView>(`/ops/live/rooms/${id}/stats`, payload)
    .then((r) => r.data)
}

// 8. 创建数字人
export function createDigitalHuman(payload: CreateDigitalHumanPayload): Promise<DigitalHumanView> {
  return request.post<DigitalHumanView>('/ops/live/digital-humans', payload).then((r) => r.data)
}

// 9. 弹幕 AI 应答
export function danmuAiReply(payload: DanmuAiReplyPayload): Promise<LiveAiReplyView> {
  return request.post<LiveAiReplyView>('/ops/live/danmu/ai-reply', payload).then((r) => r.data)
}
