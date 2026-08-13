import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';

/**
 * 选品库（规划 T 选品中心）。
 * 数据来源：平台开放 API（精选联盟/视频号小店/抖店）或适配层 Product（集成时）或手动录入；不采集个体隐私。
 */
@Entity({ name: 'ops_selection_products' })
export class SelectionProductEntity extends BaseEntity {
  @Index()
  @Column({
    type: 'varchar',
    length: 32,
    comment: '选品来源: platform(平台开放API)/manual(手动录入)/system(管理系统)',
  })
  source!: string;

  @Column({
    type: 'varchar',
    length: 32,
    nullable: true,
    comment: '平台: douyin/wechat/jingxuan(精选联盟)',
  })
  platform?: string | null;

  @Index()
  @Column({
    type: 'varchar',
    length: 128,
    nullable: true,
    comment: '外部商品ID（平台/管理系统）',
  })
  externalProductId?: string | null;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0, comment: '佣金率百分比' })
  commissionRate!: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true, comment: '口碑分（≥4.6 优）' })
  reputationScore?: number | null;

  @Column({ type: 'int', default: 0, comment: '近30天销量' })
  sales30d!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true, comment: '价格' })
  price?: number | null;

  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true, comment: '类目' })
  category?: string | null;

  @Column({
    type: 'varchar',
    length: 16,
    nullable: true,
    comment: '人性驱动（映射 D 字典：选品→内容 R 联动）',
  })
  humanDriver?: string | null;

  @Column({ type: 'json', nullable: true, comment: '扩展指标（销量趋势/评分明细等）' })
  metrics?: Record<string, unknown> | null;

  @Column({ type: 'datetime', nullable: true, comment: '采集时间' })
  collectedAt?: Date | null;
}
