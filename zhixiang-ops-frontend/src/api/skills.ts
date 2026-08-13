import request from '@/utils/request'

// Z 技能中心（规划 §4-Z / 管理平面）

export type SkillType =
  | 'text-generate'
  | 'image-generate'
  | 'video-generate'
  | 'voice-clone'
  | 'digital-human'

export interface SkillMarketItem {
  id: number
  type: SkillType
  name: string
  description?: string
  builtin: boolean
  systemEnabled: boolean
  installed: boolean
  enabled: boolean
  providerId?: number
}

export interface SkillProvider {
  id: number
  type: SkillType
  name: string
  source: string
  models?: string[]
  isDefault: boolean
  enabled: boolean
}

export interface InstalledSkill {
  skillId: number
  type: SkillType
  name: string
  providerId?: number
}

export function getMarket() {
  return request.get('/ops/skills').then((r) => r.data as SkillMarketItem[])
}
export function getProviders() {
  return request.get('/ops/skills/providers').then((r) => r.data as SkillProvider[])
}
export function getInstalled() {
  return request.get('/ops/skills/installed').then((r) => r.data as InstalledSkill[])
}
export function installSkill(id: number, providerId?: number) {
  return request
    .post(`/ops/skills/${id}/install`, providerId ? { providerId } : {})
    .then((r) => r.data as SkillMarketItem)
}
export function uninstallSkill(id: number) {
  return request.post(`/ops/skills/${id}/uninstall`).then((r) => r.data as SkillMarketItem)
}
export function setProvider(id: number, providerId: number) {
  return request
    .put(`/ops/skills/${id}/provider`, { providerId })
    .then((r) => r.data as SkillMarketItem)
}
