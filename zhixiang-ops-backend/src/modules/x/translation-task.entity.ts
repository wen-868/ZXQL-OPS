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

/** 译制任务状态（X 内容出海 / 阶段3 增强） */
export type TranslationTaskStatus = 'queued' | 'translating' | 'done' | 'failed';

/**
 * 译制任务实体（规划 §4-X / 开发顺序 X 内容出海 / 阶段3 增强）。
 * 经 SkillGateway(text-generate) 将源文案翻译为目标语言；结果存 translatedScript。
 * 关联出海视频 videoId→X。所有记录带 tenantId 强隔离。
 */
@Entity({ name: 'ops_translation_tasks' })
@Index(['tenantId', 'status'])
export class TranslationTaskEntity extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  videoId!: number;

  @Column({ type: 'varchar', length: 16, comment: '源语言' })
  sourceLang!: string;

  @Column({ type: 'varchar', length: 16, comment: '目标语言' })
  targetLang!: string;

  @Column({ type: 'text' })
  sourceText!: string;

  @Column({ type: 'text', nullable: true })
  translatedScript?: string;

  @Column({ type: 'varchar', length: 16, default: 'queued' })
  status!: TranslationTaskStatus;

  @Column({ type: 'json', nullable: true })
  meta?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
