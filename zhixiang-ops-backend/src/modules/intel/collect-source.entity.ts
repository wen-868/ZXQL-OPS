import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { CleaningOptions } from './intel.types';

/**
 * 采集源配置实体（ops_collect_sources）。
 * 一个"真实可控"的采集源 = 目标（URL 或关键词）+ 平台 + 清洗开关 + 限频 + 启停状态。
 * mode: web（公开网页抓取） / local（本地样本，联调用）。
 * 由源发起的采集任务继承源配置（cleaning/rate_limit/target），任务级仍可覆盖。
 */
@Entity('ops_collect_sources')
export class CollectSourceEntity extends BaseEntity {
  @Index()
  @Column({ type: 'varchar', length: 36 })
  tenantId: string;

  @Column({ type: 'varchar', length: 128 })
  name: string;

  @Column({ type: 'varchar', length: 32 })
  platform: string;

  /** 采集内容类型：comment / hot / keyword / url */
  @Column({ name: 'source_type', type: 'varchar', length: 32, default: 'comment' })
  sourceType: string;

  /** 目标：URL（mode=web 直接抓取）或 关键词（拼平台搜索页） */
  @Column({ type: 'varchar', length: 512 })
  target: string;

  /** 采集模式：web=公开网页抓取（真实）/ local=本地样本（联调） */
  @Column({ type: 'varchar', length: 16, default: 'web' })
  mode: string;

  /** 每分钟限频上限（令牌桶容量，按 tenant+platform 共享） */
  @Column({ name: 'rate_limit', type: 'int', default: 10 })
  rateLimit: number;

  /** 清洗开关：{ dedup, piiStrip, adFilter, reviewRequired } */
  @Column({ type: 'json', nullable: true })
  cleaning?: CleaningOptions;

  /** 扩展配置：{ headers?, selectors?, retries?, timeoutMs? } */
  @Column({ type: 'json', nullable: true })
  config?: Record<string, unknown>;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ name: 'last_collected_at', type: 'datetime', nullable: true })
  lastCollectedAt?: Date;

  @Column({ name: 'collect_count', type: 'int', default: 0 })
  collectCount: number;

  @Column({ name: 'error_msg', type: 'text', nullable: true })
  errorMsg?: string;
}
