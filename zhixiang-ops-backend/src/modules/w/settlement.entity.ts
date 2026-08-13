import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { SettlementType, SettlementStatus, SettlementPartyView } from './w.types';

/**
 * 分账（规划 §4-W）。
 * - type 为分账场景（机构-达人-投手）；parties 为各方明细 JSON [{role,name,amount}]。
 * - MVP 内嵌本地分账计算；connected 模式接入管理系统时替换为 Commission 适配层真实分账。
 */
@Entity({ name: 'ops_settlement' })
@Index(['tenantId', 'type'])
@Index(['tenantId', 'status'])
export class SettlementEntity extends BaseEntity {
  @Column({
    name: 'type',
    type: 'varchar',
    length: 32,
    default: 'org_talent_advertiser',
    comment: '分账类型: 机构-达人-投手',
  })
  type!: SettlementType;

  @Column({ name: 'parties', type: 'json', comment: '分账各方: [{role,name,amount}]' })
  parties!: SettlementPartyView[];

  @Column({
    name: 'amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    comment: '分账总额',
  })
  amount!: number;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 32,
    default: 'pending',
    comment: 'pending/settled/invoiced',
  })
  status!: SettlementStatus;
}
