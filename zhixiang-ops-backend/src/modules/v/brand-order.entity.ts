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

/** 商单状态（V 达人/商单管理 / 阶段3 增强） */
export type BrandOrderStatus =
  'pending' | 'negotiating' | 'signed' | 'delivering' | 'completed' | 'settled' | 'cancelled';

/**
 * 商单实体（规划 §4-V / 开发顺序 V 达人/商单管理 / 阶段3 增强）。
 * 关联达人(talent_id→V)、商品(product_id→R，弱关联)、B 发货账号、H 成片。
 * 金额用 decimal；分账落地到 W（settlement_id 引用）。所有记录带 tenantId 强隔离。
 */
@Entity({ name: 'ops_brand_orders' })
@Index(['tenantId', 'status'])
@Index(['tenantId', 'advertiser'])
export class BrandOrderEntity extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 128 })
  advertiser!: string;

  @Column({ type: 'int' })
  talentId!: number;

  @Column({ type: 'int', nullable: true })
  productId?: number;

  @Column({ type: 'int', nullable: true })
  accountId?: number;

  @Column({ type: 'int', nullable: true })
  videoId?: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, comment: '商单金额' })
  amount!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0, comment: '机构分成比例%' })
  agencyShareRate!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0, comment: '达人分成比例%' })
  talentShareRate!: number;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status!: BrandOrderStatus;

  @Column({ type: 'varchar', length: 64, nullable: true })
  contractNo?: string;

  /** 结算关联：分账落地 W 后回填 settlement.id */
  @Column({ type: 'int', nullable: true })
  settlementId?: number;

  @Column({ type: 'json', nullable: true })
  meta?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
