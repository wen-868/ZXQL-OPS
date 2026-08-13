import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { ReconciliationStatus } from './w.types';

/**
 * 对账（规划 §4-W）。
 * - order_amount 期内收入/订单总额；commission_amount 佣金合计；settled_amount 已结算合计；diff 差额。
 * - 关联 Y 订单（Y 未建时按 revenue 汇总兜底）；status 由 diff 自动判定。
 */
@Entity({ name: 'ops_reconciliation' })
@Index(['tenantId', 'period'])
export class ReconciliationEntity extends BaseEntity {
  @Column({ name: 'period', type: 'varchar', length: 32, comment: '对账周期(YYYY-MM)' })
  period!: string;

  @Column({
    name: 'order_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    comment: '订单/收入总额',
  })
  orderAmount!: number;

  @Column({
    name: 'commission_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    comment: '佣金合计',
  })
  commissionAmount!: number;

  @Column({
    name: 'settled_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    comment: '已结算合计',
  })
  settledAmount!: number;

  @Column({
    name: 'diff',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    comment: '差额(应收-已结算)',
  })
  diff!: number;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 32,
    default: 'pending',
    comment: 'pending/matched/diff_found',
  })
  status!: ReconciliationStatus;
}
