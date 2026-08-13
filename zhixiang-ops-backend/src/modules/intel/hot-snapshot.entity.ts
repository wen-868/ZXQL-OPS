import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { HotType } from './intel.types';

/**
 * 热点快照实体（规划 §4-C / ops_hot_snapshots）。
 * 记录各平台热点榜抓取结果，供选题（E）与情报看板使用。
 */
@Entity('ops_hot_snapshots')
export class HotSnapshotEntity extends BaseEntity {
  @Index()
  @Column({ type: 'varchar', length: 32 })
  platform: string;

  @Column({ type: 'varchar', length: 16 })
  hotType: HotType;

  @Column({ type: 'varchar', length: 256 })
  title: string;

  @Column({ type: 'int', default: 0 })
  heat: number;

  @Column({ type: 'varchar', length: 512, nullable: true })
  url?: string;

  @Column({ type: 'timestamp' })
  capturedAt: Date;
}
