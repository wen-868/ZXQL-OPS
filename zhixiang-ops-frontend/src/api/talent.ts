import request from '@/utils/request'
import type { PageResult } from '@/api/team'

// V 达人商单（规划 §4-V / 阶段3 增强）

export type TalentType = 'internal' | 'external' | 'agency'
export type TalentStatus = 'active' | 'inactive' | 'cooperation_ended'
export type BrandOrderStatus =
  | 'pending'
  | 'negotiating'
  | 'signed'
  | 'delivering'
  | 'completed'
  | 'settled'
  | 'cancelled'

export interface Talent {
  id: number
  name: string
  type?: TalentType
  contact?: string
  talentAccountId?: number
  digitalHumanId?: number
  agencyShareRate?: number
  talentShareRate?: number
  status?: TalentStatus
  meta?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface BrandOrder {
  id: number
  advertiser: string
  talentId: number
  productId?: number
  accountId?: number
  videoId?: number
  amount: number
  agencyShareRate?: number
  talentShareRate?: number
  status: BrandOrderStatus
  contractNo?: string
  settlementId?: number
  meta?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface TalentSummary {
  talentCount: number
  activeTalentCount: number
  orderCount: number
  settledCount: number
  totalAmount: number
  settledAmount: number
}

export interface CreateTalentDto {
  name: string
  type?: TalentType
  contact?: string
  talentAccountId?: number
  digitalHumanId?: number
  agencyShareRate?: number
  talentShareRate?: number
  status?: TalentStatus
  meta?: Record<string, unknown>
}

export interface UpdateTalentDto {
  name?: string
  type?: TalentType
  contact?: string
  talentAccountId?: number
  digitalHumanId?: number
  agencyShareRate?: number
  talentShareRate?: number
  status?: TalentStatus
  meta?: Record<string, unknown>
}

export interface CreateBrandOrderDto {
  advertiser: string
  talentId: number
  productId?: number
  accountId?: number
  videoId?: number
  amount: number
  agencyShareRate?: number
  talentShareRate?: number
  status?: BrandOrderStatus
  contractNo?: string
  meta?: Record<string, unknown>
}

export interface SettleBrandOrderDto {
  talentShareRate: number
  toStatus?: 'completed' | 'settled'
}

export function listTalents(params: { page?: number; pageSize?: number }) {
  return request.get('/ops/talent/talents', { params }).then((r) => r.data as PageResult<Talent>)
}
export function createTalent(dto: CreateTalentDto) {
  return request.post('/ops/talent/talents', dto).then((r) => r.data as Talent)
}
export function getTalent(id: number) {
  return request.get(`/ops/talent/talents/${id}`).then((r) => r.data as Talent)
}
export function updateTalent(id: number, dto: UpdateTalentDto) {
  return request.put(`/ops/talent/talents/${id}`, dto).then((r) => r.data as Talent)
}
export function deleteTalent(id: number) {
  return request.delete(`/ops/talent/talents/${id}`).then((r) => r.data as { id: number })
}
export function listBrandOrders(params: { page?: number; pageSize?: number; status?: string }) {
  return request.get('/ops/talent/brand-orders', { params }).then((r) => r.data as PageResult<BrandOrder>)
}
export function createBrandOrder(dto: CreateBrandOrderDto) {
  return request.post('/ops/talent/brand-orders', dto).then((r) => r.data as BrandOrder)
}
export function settleBrandOrder(id: number, dto: SettleBrandOrderDto) {
  return request.post(`/ops/talent/brand-orders/${id}/settle`, dto).then((r) => r.data as BrandOrder)
}
export function getTalentSummary() {
  return request.get('/ops/talent/summary').then((r) => r.data as TalentSummary)
}
