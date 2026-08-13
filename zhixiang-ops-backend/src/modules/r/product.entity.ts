import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { ProductSourceType } from './r.types';

/**
 * 商品（规划 R 商品内容中心）。
 * - 数据来源三态：system(管理系统适配层)/manual(手动)/competitor(竞品)/t_selection(选品联动 T)。
 * - stock 为库存单一真源（standalone 模式在运营系统；connected 模式由 Y 扣减/回写）。
 * - humanDriver 映射 D 字典（选品→内容联动）。
 */
@Entity({ name: 'ops_products' })
export class ProductEntity extends BaseEntity {
  @Index()
  @Column({
    type: 'varchar',
    length: 16,
    comment: '商品来源: system(管理系统)/manual(手动)/competitor(竞品)/t_selection(选品联动)',
  })
  sourceType!: ProductSourceType;

  @Index()
  @Column({
    type: 'varchar',
    length: 128,
    nullable: true,
    comment: '外部商品ID（管理系统/平台）',
  })
  externalProductId?: string | null;

  @Index()
  @Column({ type: 'int', nullable: true, comment: '关联 T 选品 ID（sourceType=t_selection）' })
  selectionProductId?: number | null;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'int', default: 0, comment: '库存（单一真源，Y 扣减/回写）' })
  stock!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true, comment: '价格' })
  price?: number | null;

  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true, comment: '类目' })
  category?: string | null;

  @Column({
    type: 'varchar',
    length: 16,
    nullable: true,
    comment: '人性驱动（映射 D 字典：选品→内容联动）',
  })
  humanDriver?: string | null;
}
