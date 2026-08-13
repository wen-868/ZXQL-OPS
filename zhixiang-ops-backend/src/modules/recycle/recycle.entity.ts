import { BaseEntity } from '../../database/base.entity';
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { RecycleMetrics } from './recycle.types';

/** 回收反馈（规划 §4-J / ops_feedback） */
@Entity('ops_feedback')
@Index('idx_feedback_tenant_video', ['tenantId', 'videoId'])
export class FeedbackEntity extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int', nullable: true })
  topicId?: number | null;

  /** 视频/发布任务 id（I ops_publish_tasks.id） */
  @Column({ type: 'int', nullable: true })
  videoId?: number | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  platform?: string | null;

  /** 归因标识：透传 I（F→I→J 只读，禁止重生成） */
  @Column({ type: 'varchar', length: 64 })
  attributionId!: string;

  @Column({ type: 'json', nullable: true })
  metrics?: RecycleMetrics | null;

  @Column({ type: 'json', nullable: true })
  comments?: string[] | null;

  /** 回流 D 再分析任务 id（闭环） */
  @Column({ type: 'int', nullable: true })
  reAnalysisId?: number | null;

  @Column({ type: 'datetime', nullable: true })
  collectedAt?: Date | null;
}

/** 回收任务（规划 §4-J / ops_recycle_tasks） */
@Entity('ops_recycle_tasks')
@Index('idx_recycle_tenant', ['tenantId'])
export class RecycleTaskEntity extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 16 })
  scope!: string;

  /** 目标引用：video=发布任务 id；account=账号 id；all=全量 */
  @Column({ type: 'varchar', length: 64 })
  targetRef!: string;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status!: string;

  @Column({ type: 'int', default: 0 })
  progress!: number;

  @Column({ type: 'datetime', nullable: true })
  lastCollectedAt?: Date | null;
}

/** 人性效能（规划 §4-J / ops_driver_efficiency，反哺 E 权重） */
@Entity('ops_driver_efficiency')
@Index('idx_de_tenant_window', ['tenantId', 'window', 'statDate'])
export class DriverEfficiencyEntity extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 32 })
  driver!: string;

  @Column({ type: 'varchar', length: 32 })
  emotion!: string;

  @Column({ type: 'int', default: 0 })
  sampleCount!: number;

  @Column({ type: 'int', default: 0 })
  avgPlay!: number;

  @Column({ type: 'float', default: 0 })
  avgCompleteRate!: number;

  @Column({ type: 'float', default: 0 })
  avgInteractRate!: number;

  @Column({ type: 'float', default: 0 })
  avgConversion!: number;

  @Column({ type: 'varchar', length: 16, default: 'day' })
  window!: string;

  @Column({ type: 'date' })
  statDate!: Date;
}
