import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { RevenueSource, RevenueStatus } from './w.types';

/**
 * 收益记录（规划 §4-W）。
 * - source 区分 佣金/坑位费/服务费/打赏/补贴；related_order_id 关联 Y.orders（Y 未建时可为空）。
 * - 双模式：联通模式收益读管理系统 Commission 适配层；独立模式自营录入。
 */
@Entity({ name: 'ops_revenue_records' })
@Index(['tenantId', 'source'])
@Index(['tenantId', 'platform'])
export class RevenueRecordEntity extends BaseEntity {
  @Column({
    name: 'source',
    type: 'varchar',
    length: 32,
    default: 'commission',
    comment: '收入来源: commission/slot_fee/service_fee/tip/subsidy',
  })
  source!: RevenueSource;

  @Column({ name: 'platform', type: 'varchar', length: 32, comment: '平台' })
  platform!: string;

  @Column({
    name: 'amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    comment: '收入金额',
  })
  amount!: number;

  @Column({
    name: 'related_order_id',
    type: 'varchar',
    length: 128,
    nullable: true,
    comment: '关联订单ID(→Y.orders，Y 未建时可为空)',
  })
  relatedOrderId?: string | null;

  @Column({
    name: 'commission',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    comment: '佣金',
  })
  commission!: number;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 32,
    default: 'pending',
    comment: 'pending/settled',
  })
  status!: RevenueStatus;
}
