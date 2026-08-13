/** V 达人/商单管理 类型与错误码（规划 §4-V / 阶段3 增强）。 */
import type { BrandOrderEntity, BrandOrderStatus } from './brand-order.entity';
import type { TalentEntity, TalentStatus, TalentType } from './talent.entity';

export type { BrandOrderEntity, BrandOrderStatus, TalentEntity, TalentStatus, TalentType };

/** 达人状态集合（校验/枚举展示用） */
export const TALENT_STATUSES: TalentStatus[] = ['active', 'inactive', 'cooperation_ended'];
export const TALENT_TYPES: TalentType[] = ['internal', 'external', 'agency'];
export const BRAND_ORDER_STATUSES: BrandOrderStatus[] = [
  'pending',
  'negotiating',
  'signed',
  'delivering',
  'completed',
  'settled',
  'cancelled',
];

/** 商单状态流转（白名单） */
export const BRAND_ORDER_TRANSITIONS: Record<BrandOrderStatus, BrandOrderStatus[]> = {
  pending: ['negotiating', 'cancelled'],
  negotiating: ['signed', 'cancelled'],
  signed: ['delivering', 'cancelled'],
  delivering: ['completed', 'cancelled'],
  completed: ['settled'],
  settled: [],
  cancelled: [],
};

export class VError extends Error {}
