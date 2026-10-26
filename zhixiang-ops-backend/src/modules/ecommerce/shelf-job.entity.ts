import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { EcommercePlatform, ShelfAction, ShelfJobStatus } from './ecommerce.types';

/**
 * 上下架执行记录（审计与幂等）。
 * 每次评估产出动作即落一条记录；同 rule+action 最近 30 分钟已执行则跳过（幂等防抖）。
 */
@Entity({ name: 'ops_shelf_jobs' })
@Index(['tenantId', 'platform'])
@Index(['tenantId', 'status'])
export class ShelfJobEntity extends BaseEntity {
  @Index()
  @Column({ name: 'rule_id', type: 'int' })
  ruleId!: number;

  @Index()
  @Column({ name: 'product_id', type: 'int' })
  productId!: number;

  @Column({ name: 'platform', type: 'varchar', length: 32 })
  platform!: EcommercePlatform;

  @Column({ name: 'action', type: 'varchar', length: 8 })
  action!: ShelfAction;

  @Column({ name: 'status', type: 'varchar', length: 16, default: 'queued' })
  status!: ShelfJobStatus;

  @Column({ name: 'reason', type: 'text', nullable: true })
  reason?: string | null;

  @Column({ name: 'platform_result', type: 'json', nullable: true })
  platformResult?: Record<string, unknown> | null;

  @Column({ name: 'ext_shelf_id', type: 'varchar', length: 128, nullable: true })
  extShelfId?: string | null;
}
