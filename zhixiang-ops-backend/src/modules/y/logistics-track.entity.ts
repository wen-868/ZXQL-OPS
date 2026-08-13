import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';

/** 物流轨迹 */
@Entity({ name: 'ops_logistics_tracks' })
export class LogisticsTrackEntity extends BaseEntity {
  @Index()
  @Column({ type: 'bigint', unsigned: true, comment: '关联 ops_orders.id' })
  orderId!: number;

  @Column({ type: 'varchar', length: 32, comment: '承运商' })
  carrier!: string;

  @Column({ type: 'varchar', length: 64, comment: '运单号' })
  trackingNo!: string;

  @Column({ type: 'varchar', length: 16, default: 'pending', comment: '轨迹状态' })
  status!: string;

  @Column({ type: 'varchar', length: 255, comment: '节点描述' })
  node!: string;

  @Column({ type: 'datetime', comment: '轨迹时间' })
  ts!: Date;
}
