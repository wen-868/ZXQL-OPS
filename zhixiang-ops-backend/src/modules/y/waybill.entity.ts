import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';

export type WaybillPrintStatus = 'pending' | 'printed';

/** 电子面单 */
@Entity({ name: 'ops_waybills' })
export class WaybillEntity extends BaseEntity {
  @Index()
  @Column({ type: 'bigint', unsigned: true, comment: '关联 ops_orders.id' })
  orderId!: number;

  @Column({ type: 'varchar', length: 32, comment: '承运商' })
  carrier!: string;

  @Index()
  @Column({ type: 'varchar', length: 64, comment: '运单号' })
  trackingNo!: string;

  @Column({ type: 'varchar', length: 16, default: 'pending', comment: '打印状态' })
  printStatus!: WaybillPrintStatus;

  @Column({ type: 'datetime', nullable: true, comment: '打印时间' })
  printedAt?: Date | null;
}
