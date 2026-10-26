import { Column, Entity, Index, Unique } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { EcommercePlatform, ShelfAction, ShelfStatus } from './ecommerce.types';

/**
 * 商品在平台的上下架状态（持久化最新一次动作结果，供查询与幂等）。
 * 同一商品同一平台唯一一行。
 */
@Entity({ name: 'ops_product_platforms' })
@Unique(['tenantId', 'productId', 'platform'])
export class ProductPlatformEntity extends BaseEntity {
  @Index()
  @Column({ name: 'product_id', type: 'int' })
  productId!: number;

  @Index()
  @Column({ name: 'platform', type: 'varchar', length: 32 })
  platform!: EcommercePlatform;

  @Column({ name: 'shelf_status', type: 'varchar', length: 16, default: 'unknown' })
  shelfStatus!: ShelfStatus;

  @Column({ name: 'ext_shelf_id', type: 'varchar', length: 128, nullable: true })
  extShelfId?: string | null;

  @Column({ name: 'last_action', type: 'varchar', length: 8, nullable: true })
  lastAction?: ShelfAction | null;

  @Column({ name: 'last_action_at', type: 'datetime', nullable: true })
  lastActionAt?: Date | null;
}
