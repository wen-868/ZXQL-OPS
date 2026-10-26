import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { EcommercePlatform, RuleAction, ShelfStrategyType } from './ecommerce.types';

/**
 * 上下架规则（电商自动上下架核心配置）。
 * 一条规则绑定一个商品在某个平台的上下架策略，可独立启停。
 * params 按策略类型解释（见 shelf.service evaluateRules）：
 * - inventory: { threshold?: number; autoRestore?: boolean }
 * - time:      { windowStart?: 'HH:mm'; windowEnd?: 'HH:mm'; dates?: string[] }
 * - price:     { minPrice?: number; maxPrice?: number }
 * - compliance:{ needScan?: boolean }
 * - weight:    { topN?: number; sortBy?: 'price' | 'createdAt' }
 */
@Entity({ name: 'ops_shelf_rules' })
@Index(['tenantId', 'platform'])
@Index(['tenantId', 'status'])
export class ShelfRuleEntity extends BaseEntity {
  @Index()
  @Column({ name: 'platform', type: 'varchar', length: 32 })
  platform!: EcommercePlatform;

  @Index()
  @Column({ name: 'product_id', type: 'int', comment: '关联 ops_products.id' })
  productId!: number;

  @Column({ name: 'strategy', type: 'varchar', length: 16 })
  strategy!: ShelfStrategyType;

  @Column({ name: 'action', type: 'varchar', length: 8, default: 'auto' })
  action!: RuleAction;

  @Column({ name: 'params', type: 'json', nullable: true })
  params?: Record<string, unknown> | null;

  @Column({ name: 'enabled', type: 'boolean', default: true })
  enabled!: boolean;

  @Column({ name: 'priority', type: 'int', default: 0, comment: '同策略优先级（weight 分组排序）' })
  priority!: number;

  @Column({ name: 'status', type: 'varchar', length: 16, default: 'active' })
  status!: 'active' | 'disabled';

  @Column({ name: 'last_eval_at', type: 'datetime', nullable: true })
  lastEvalAt?: Date | null;

  @Column({ name: 'last_action', type: 'varchar', length: 8, nullable: true })
  lastAction?: RuleAction | null;
}
