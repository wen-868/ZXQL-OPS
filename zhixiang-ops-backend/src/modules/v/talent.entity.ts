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

/** 达人状态（V 达人/商单管理 / 阶段3 增强） */
export type TalentStatus = 'active' | 'inactive' | 'cooperation_ended';

/** 达人类型：内部自制 / 外部签约 / 机构（MCN 旗下） */
export type TalentType = 'internal' | 'external' | 'agency';

/**
 * 达人库实体（规划 §4-V / 开发顺序 V 达人/商单管理 / 阶段3 增强）。
 * 复用 B 平台账号作为带货主体（talent_account_id→B），弱关联，不强制。
 * 金额字段用 decimal 存储（复用 W 约定，避免浮点误差）。所有记录带 tenantId 强隔离。
 */
@Entity({ name: 'ops_talents' })
@Index(['tenantId', 'status'])
export class TalentEntity extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 64 })
  name!: string;

  @Column({ type: 'varchar', length: 32, default: 'internal' })
  type!: TalentType;

  @Column({ type: 'varchar', length: 128, nullable: true })
  contact?: string;

  @Column({ type: 'int', nullable: true })
  talentAccountId?: number;

  @Column({ type: 'int', nullable: true })
  digitalHumanId?: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0, comment: '机构分成比例%' })
  agencyShareRate!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0, comment: '达人分成比例%' })
  talentShareRate!: number;

  @Column({ type: 'varchar', length: 16, default: 'active' })
  status!: TalentStatus;

  @Column({ type: 'json', nullable: true })
  meta?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
