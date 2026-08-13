import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';

/**
 * 投放指标（规划 §4-S）。
 * - 按 campaign_id + date 维度记录消耗/转化；供实时监控与复盘。
 */
@Entity({ name: 'ops_ad_metrics' })
@Index(['tenantId', 'campaignId'])
export class AdMetricEntity extends BaseEntity {
  @Column({ name: 'campaign_id', type: 'int', comment: '关联投放计划 id' })
  campaignId!: number;

  @Column({ name: 'date', type: 'date', comment: '统计日期' })
  date!: Date;

  @Column({ name: 'impressions', type: 'int', default: 0, comment: '曝光' })
  impressions!: number;

  @Column({ name: 'clicks', type: 'int', default: 0, comment: '点击' })
  clicks!: number;

  @Column({ name: 'conversions', type: 'int', default: 0, comment: '转化' })
  conversions!: number;

  @Column({ name: 'cost', type: 'decimal', precision: 12, scale: 2, default: 0, comment: '花费' })
  cost!: number;

  @Column({ name: 'roi', type: 'decimal', precision: 6, scale: 2, default: 0, comment: 'ROI' })
  roi!: number;
}
