import request from '@/utils/request'

// AA 智能客服（规划 §4-AA，路由前缀 /api/ops）
// 注意：响应拦截器已把 response.data 改写为业务 data，调用方 .then(r => r.data) 直接得业务 T。
// 类型以 src/modules/aa/aa.types.ts 为准。

export type CsChannel =
  | 'live_comment'
  | 'private_dm'
  | 'short_video_comment'
  | 'order_message'
export type CsSessionStatus = 'open' | 'transferred' | 'closed'
export type TicketStatus = 'open' | 'pending' | 'resolved' | 'closed'
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'
export type KnowledgeCategory = 'product' | 'order' | 'logistics' | 'faq'

export interface CsMessage {
  id: number
  sessionId: number
  role: 'user' | 'ai' | 'agent'
  content: string
  intent?: string
  confidence?: number
  createdAt: string
}

export interface SessionView {
  id: number
  channel: CsChannel
  buyerRef: string
  relatedOrderId?: string
  relatedProductId?: number
  status: CsSessionStatus
  lastMessage?: string
  messageCount: number
  createdAt: string
  updatedAt: string
}

export interface SessionDetail {
  session: SessionView
  messages: CsMessage[]
}

export interface AiReplyView {
  reply: string
  intent?: string
  confidence?: number
  transferred: boolean
  ticketId?: number
}

export interface SendMessageResult {
  session: SessionView
  userMessage: CsMessage
  aiReply: AiReplyView | null
}

export interface TicketView {
  id: number
  sessionId: number
  buyerRef?: string
  issue?: string
  status: TicketStatus
  priority: TicketPriority
  assignedTo?: string
  createdAt: string
  updatedAt: string
}

export interface KnowledgeView {
  id: number
  category: KnowledgeCategory
  question: string
  answer: string
  source?: string
  createdAt: string
  updatedAt: string
}

export interface CsSettings {
  id: number
  enabledChannels: string[]
  transferThreshold: number
  autoReplyEnabled: boolean
  greeting: string | null
  workingHours: string | null
  createdAt: string
  updatedAt: string
}

export function createSession(dto: {
  channel: CsChannel
  buyerRef: string
  relatedOrderId?: string
  relatedProductId?: number
}): Promise<SessionView> {
  return request.post<SessionView>('/ops/cs/sessions', dto).then((r) => r.data)
}

export function listSessions(params?: { channel?: CsChannel; status?: CsSessionStatus }): Promise<SessionView[]> {
  return request.get<SessionView[]>('/ops/cs/sessions', { params }).then((r) => r.data)
}

export function getSession(id: number): Promise<SessionDetail> {
  return request.get<SessionDetail>(`/ops/cs/sessions/${id}`).then((r) => r.data)
}

export function sendMessage(id: number, content: string): Promise<SendMessageResult> {
  return request.post<SendMessageResult>(`/ops/cs/sessions/${id}/messages`, { content }).then((r) => r.data)
}

export function transfer(id: number, dto?: { issue?: string; priority?: TicketPriority }): Promise<TicketView> {
  return request.post<TicketView>(`/ops/cs/sessions/${id}/transfer`, dto ?? {}).then((r) => r.data)
}

export function listTickets(params?: { status?: TicketStatus; priority?: TicketPriority }): Promise<TicketView[]> {
  return request.get<TicketView[]>('/ops/cs/tickets', { params }).then((r) => r.data)
}

export function getTicket(id: number): Promise<TicketView> {
  return request.get<TicketView>(`/ops/cs/tickets/${id}`).then((r) => r.data)
}

export function resolveTicket(id: number): Promise<TicketView> {
  return request.post<TicketView>(`/ops/cs/tickets/${id}/resolve`).then((r) => r.data)
}

export function createKnowledge(dto: {
  category: KnowledgeCategory
  question: string
  answer: string
}): Promise<KnowledgeView> {
  return request.post<KnowledgeView>('/ops/cs/knowledge', dto).then((r) => r.data)
}

export function listKnowledge(category?: KnowledgeCategory): Promise<KnowledgeView[]> {
  return request.get<KnowledgeView[]>('/ops/cs/knowledge', { params: category ? { category } : {} }).then((r) => r.data)
}

export function updateKnowledge(
  id: number,
  dto: { category?: KnowledgeCategory; question?: string; answer?: string },
): Promise<KnowledgeView> {
  return request.put<KnowledgeView>(`/ops/cs/knowledge/${id}`, dto).then((r) => r.data)
}

export function deleteKnowledge(id: number): Promise<{ id: number }> {
  return request.delete<{ id: number }>(`/ops/cs/knowledge/${id}`).then((r) => r.data)
}

export function getSettings(): Promise<CsSettings> {
  return request.get<CsSettings>('/ops/cs/settings').then((r) => r.data)
}

export function upsertSettings(dto: Partial<CsSettings>): Promise<CsSettings> {
  return request.put<CsSettings>('/ops/cs/settings', dto).then((r) => r.data)
}

export function syncKnowledge(): Promise<{ added: number }> {
  return request.post<{ added: number }>('/ops/cs/knowledge/sync').then((r) => r.data)
}
