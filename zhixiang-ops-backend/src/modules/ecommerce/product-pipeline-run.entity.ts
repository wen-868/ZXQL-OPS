import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { EcommercePlatform } from './ecommerce.types';

/**
 * 商品全自动流水线执行记录（图片→卖点→详情页→自动填商品→多平台发布）。
 * 一次流水线一行，steps 记录每个环节的结果（顺序执行，环节失败标记 failed 不静默）。
 */
@Entity({ name: 'ops_product_pipeline_runs' })
@Index(['tenantId', 'status'])
export class ProductPipelineRunEntity extends BaseEntity {
  @Column({ name: 'image_url', type: 'text', nullable: true })
  imageUrl?: string | null;

  @Column({ name: 'file_name', type: 'varchar', length: 255, nullable: true })
  fileName?: string | null;

  @Index()
  @Column({ name: 'product_id', type: 'int', nullable: true })
  productId?: number | null;

  @Column({ name: 'title', type: 'varchar', length: 255, nullable: true })
  title?: string | null;

  @Column({ name: 'status', type: 'varchar', length: 16, default: 'running' })
  status!: 'running' | 'done' | 'partial' | 'failed';

  @Column({ name: 'steps', type: 'json', nullable: true })
  steps?: Record<string, { ok: boolean; reason?: string }> | null;

  @Column({ name: 'published_to', type: 'json', nullable: true })
  publishedTo?: Array<{ platform: EcommercePlatform; extProductId: string; status: string }> | null;

  @Column({ name: 'error_msg', type: 'text', nullable: true })
  errorMsg?: string | null;
}
