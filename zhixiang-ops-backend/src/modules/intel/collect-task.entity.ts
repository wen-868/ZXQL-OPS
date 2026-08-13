import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { CollectTaskStatus, CollectTaskType, SourceLevel } from './intel.types';

/**
 * 采集任务实体（规划 §4-C / ops_collect_tasks）。
 * 异步调度：create 落 pending → @Cron 工作器取 pending 处理 → running → done/failed。
 * source_level / scope / fields_collected 为合规审计字段（P 可读）。
 */
@Entity('ops_collect_tasks')
export class CollectTaskEntity extends BaseEntity {
  @Index()
  @Column({ type: 'varchar', length: 32 })
  type: CollectTaskType;

  @Column({ type: 'varchar', length: 256 })
  target: string;

  @Column({ type: 'varchar', length: 32 })
  platform: string;

  /** 采集来源级别（L1 开放 API / L2 授权公开页） */
  @Column({ type: 'varchar', length: 8, default: 'L1' })
  sourceLevel: SourceLevel;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: CollectTaskStatus;

  /** 进度 0-100 */
  @Column({ type: 'int', default: 0 })
  progress: number;

  /** 实际采集落库条数 */
  @Column({ type: 'int', default: 0 })
  collectedCount: number;

  /** 采集范围（如 ['comments','profile']） */
  @Column({ type: 'json', nullable: true })
  scope?: string[];

  /** 实际采集字段白名单（合规审计） */
  @Column({ type: 'json', nullable: true })
  fieldsCollected?: string[];

  @Column({ type: 'text', nullable: true })
  errorMsg?: string;

  @Column({ type: 'timestamp', nullable: true })
  finishedAt?: Date;
}
