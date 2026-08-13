import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { BaseEntity } from '../../database/base.entity';

/**
 * 出海平台实体（规划 §4-X / 开发顺序 X 内容出海 / 阶段3 增强）。
 * 例如 tiktok / youtube / instagram 等；code 同租户唯一。所有记录带 tenantId 强隔离。
 */
@Entity({ name: 'ops_overseas_platforms' })
@Unique(['tenantId', 'code'])
export class OverseasPlatformEntity extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 32 })
  code!: string;

  @Column({ type: 'varchar', length: 64 })
  name!: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  region?: string;

  @Column({ type: 'varchar', length: 16, nullable: true, comment: '基准语言' })
  baseLang?: string;

  @Column({ type: 'json', nullable: true })
  meta?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
