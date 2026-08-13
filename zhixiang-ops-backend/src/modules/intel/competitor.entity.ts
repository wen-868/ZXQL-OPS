import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';

/**
 * 竞品实体（规划 §4-C / ops_competitors）。
 * 记录被监控的竞品账号（平台 / 名称 / 主页 / 类目 / 监控开关 / 健康度）。
 * 全部按 tenantId 隔离（BaseEntity 已带 tenant_id）。
 */
@Entity('ops_competitors')
export class CompetitorEntity extends BaseEntity {
  @Index()
  @Column({ type: 'varchar', length: 32 })
  platform: string;

  @Column({ type: 'varchar', length: 128 })
  name: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  url?: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  category?: string;

  /** 是否开启监控采集 */
  @Column({ type: 'boolean', default: false })
  monitorEnabled: boolean;

  /** 最近一次采集时间（监控回填） */
  @Column({ type: 'timestamp', nullable: true })
  lastCollectedAt?: Date;

  /** 健康度 0-100（监控采集回填） */
  @Column({ type: 'int', default: 0 })
  healthScore: number;
}
