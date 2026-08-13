import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';

/**
 * 商品详情页（图文 sections）。
 */
@Entity({ name: 'ops_product_detail_pages' })
export class ProductDetailPageEntity extends BaseEntity {
  @Index()
  @Column({ type: 'int', comment: '关联商品 ID' })
  productId!: number;

  @Column({ type: 'json', nullable: true, comment: '详情页 sections（图文区块）' })
  sections?: Record<string, unknown>[] | null;
}
