import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { ComplianceRisk, ContentStatus } from './r.types';

/**
 * 商品内容（AI 生成：标题/卖点/详情/话术/种草）。
 * 同一商品可多版本（version 自增），human_driver 映射 D 字典，compliance_risk 联动 P 合规。
 */
@Entity({ name: 'ops_product_contents' })
export class ProductContentEntity extends BaseEntity {
  @Index()
  @Column({ type: 'int', comment: '关联商品 ID' })
  productId!: number;

  @Column({
    type: 'varchar',
    length: 16,
    nullable: true,
    comment: '人性驱动（映射 D 字典）',
  })
  humanDriver?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, comment: 'AI 标题' })
  titleAi?: string | null;

  @Column({ type: 'text', nullable: true, comment: '卖点（映射人性）' })
  sellingPoint?: string | null;

  @Column({ type: 'json', nullable: true, comment: '图文详情 sections' })
  content?: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true, comment: '口播/直播话术' })
  script?: string | null;

  @Column({ type: 'text', nullable: true, comment: '种草文案（小红书）' })
  xhsCopy?: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true, comment: '模板 ID' })
  templateId?: string | null;

  @Column({ type: 'int', default: 1, comment: '版本号（自增）' })
  version!: number;

  @Column({ type: 'varchar', length: 16, default: 'none', comment: '合规风险等级' })
  complianceRisk!: ComplianceRisk;

  @Column({ type: 'varchar', length: 16, default: 'draft', comment: '状态' })
  status!: ContentStatus;
}
