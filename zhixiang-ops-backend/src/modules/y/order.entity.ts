import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';

export type OrderSource = 'management' | 'platform';
export type OrderStatus = 'pending_payment' | 'paid' | 'shipped' | 'completed' | 'refunded';
export type LogisticsStatus = 'pending' | 'in_transit' | 'delivered';

/** 运营订单（Y 订单与物流中心核心表） */
@Entity({ name: 'ops_orders' })
@Index(['tenantId', 'orderId'], { unique: true })
export class OrderEntity extends BaseEntity {
  @Column({
    type: 'varchar',
    length: 16,
    comment: '订单来源: management(管理系统)/platform(平台开放订单)',
  })
  source!: OrderSource;

  @Column({ type: 'varchar', length: 32, comment: '平台' })
  platform!: string;

  @Index()
  @Column({ type: 'varchar', length: 64, comment: '平台/外部订单号（幂等去重键）' })
  orderId!: string;

  @Index()
  @Column({
    type: 'bigint',
    unsigned: true,
    nullable: true,
    comment: '关联 R 商品 id（库存单一真源）',
  })
  productId?: number | null;

  @Column({ type: 'int', default: 1, comment: '购买数量（库存扣减单位）' })
  quantity!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, comment: '订单金额' })
  amount!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, comment: '佣金' })
  commission!: number;

  @Index()
  @Column({ type: 'varchar', length: 16, default: 'pending_payment', comment: '订单状态' })
  status!: OrderStatus;

  @Column({ type: 'varchar', length: 16, default: 'pending', comment: '物流状态' })
  logisticsStatus!: LogisticsStatus;

  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true, comment: '归因标识（来自 I/S 挂车转化）' })
  attributionId?: string | null;

  @Column({
    type: 'text',
    nullable: true,
    comment: '收货信息（AES 加密 JSON：name/phone/address/buyerRef）',
  })
  buyerInfo?: string | null;
}
