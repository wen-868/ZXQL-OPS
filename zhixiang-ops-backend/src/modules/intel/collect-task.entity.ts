import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { CleaningOptions, CollectTaskStatus, CollectTaskType, SourceLevel } from './intel.types';

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
  @Column({ name: 'source_level', type: 'varchar', length: 8, default: 'L1' })
  sourceLevel: SourceLevel;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: CollectTaskStatus;

  /** 进度 0-100 */
  @Column({ type: 'int', default: 0 })
  progress: number;

  /** 实际采集落库条数 */
  @Column({ name: 'collected_count', type: 'int', default: 0 })
  collectedCount: number;

  /** 重试次数（retry 控制动作累加） */
  @Column({ name: 'retry_count', type: 'int', default: 0 })
  retryCount: number;

  /** 关联采集源（由源发起时回填） */
  @Column({ name: 'source_id', type: 'bigint', nullable: true })
  sourceId?: number;

  /** 本任务生效的清洗开关（覆盖源/默认值） */
  @Column({ type: 'json', nullable: true })
  cleaning?: CleaningOptions;

  /** 本任务生效的抓取扩展配置（来源 config 快照：headers/timeoutMs/retries） */
  @Column({ type: 'json', nullable: true })
  config?: Record<string, unknown>;

  /** 暂停时刻（pause 动作记录，resume 清空） */
  @Column({ name: 'paused_at', type: 'datetime', nullable: true })
  pausedAt?: Date;

  /** 采集范围（如 ['comments','profile']） */
  @Column({ type: 'json', nullable: true })
  scope?: string[];

  /** 实际采集字段白名单（合规审计） */
  @Column({ type: 'json', nullable: true })
  fieldsCollected?: string[];

  @Column({ name: 'error_msg', type: 'text', nullable: true })
  errorMsg?: string;

  @Column({ name: 'finished_at', type: 'timestamp', nullable: true })
  finishedAt?: Date;
}
