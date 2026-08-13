import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BaseEntity } from '../../database/base.entity';

/** 出海视频状态（X 内容出海 / 阶段3 增强） */
export type OverseasVideoStatus = 'draft' | 'translating' | 'published' | 'failed';

/**
 * 出海视频实体（规划 §4-X / 开发顺序 X 内容出海 / 阶段3 增强）。
 * 源视频 sourceVideoId→H 成片；平台 platformId→X 出海平台；目标语言 targetLang。
 * 译制结果存 meta（transcript/dubbedUrl）。所有记录带 tenantId 强隔离。
 */
@Entity({ name: 'ops_overseas_videos' })
@Index(['tenantId', 'status'])
export class OverseasVideoEntity extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  sourceVideoId!: number;

  @Column({ type: 'int' })
  platformId!: number;

  @Column({ type: 'varchar', length: 128 })
  title!: string;

  @Column({ type: 'varchar', length: 16, comment: '目标语言' })
  targetLang!: string;

  @Column({ type: 'varchar', length: 16, default: 'draft' })
  status!: OverseasVideoStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  url?: string;

  @Column({ type: 'json', nullable: true })
  meta?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
