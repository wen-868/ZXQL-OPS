import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { AdPlanType, AdCampaignStatus } from './s.types';

/**
 * 投放计划（规划 §4-S）。
 * - account_id → 投放账户；attribution_id 在建计划时生成（ad 类），与 J 归因/ W 对账贯通。
 */
@Entity({ name: 'ops_ad_campaigns' })
@Index(['tenantId', 'accountId'])
@Index(['tenantId', 'status'])
export class AdCampaignEntity extends BaseEntity {
  @Column({ name: 'account_id', type: 'int', comment: '关联投放账户 id' })
  accountId!: number;

  @Column({ name: 'name', type: 'varchar', length: 255, comment: '计划名称' })
  name!: string;

  @Column({
    name: 'plan_type',
    type: 'varchar',
    length: 32,
    comment: '计划类型: standard/full_domain/crowd/bid',
  })
  planType!: AdPlanType;

  @Column({ name: 'audience', type: 'json', nullable: true, comment: '人群定向 JSON' })
  audience?: Record<string, unknown> | null;

  @Column({ name: 'budget', type: 'decimal', precision: 12, scale: 2, default: 0, comment: '预算' })
  budget!: number;

  @Column({
    name: 'spend',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    comment: '已消耗',
  })
  spend!: number;

  @Column({ name: 'roi', type: 'decimal', precision: 6, scale: 2, default: 0, comment: 'ROI' })
  roi!: number;

  @Column({ name: 'attribution_id', type: 'varchar', length: 96, comment: 'ad 类归因标识' })
  attributionId!: string;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 32,
    default: 'draft',
    comment: '状态: draft/running/paused/ended',
  })
  status!: AdCampaignStatus;
}
