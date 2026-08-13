import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';

export type ComplianceWordLevel = 'low' | 'medium' | 'high';
export type ComplianceWordAction = 'pass' | 'warn' | 'block';

/**
 * 违禁词库（规划 §4-P / 合规预检 P 域）。
 * 租户级词库，统一供 F 脚本 / H 成片 / I 发布 / K 直播 / AA 客服 调用 checkText 预检。
 */
@Entity('compliance_words')
export class ComplianceWordEntity extends BaseEntity {
  @Index()
  @Column({ type: 'varchar', length: 64 })
  word!: string;

  /** 分类：广告法 / 医疗 / 财经 / 违法 / 营销 / 默认 */
  @Column({ type: 'varchar', length: 32, default: 'default' })
  category!: string;

  @Column({ type: 'varchar', length: 16, default: 'high' })
  level!: ComplianceWordLevel;

  @Column({ type: 'varchar', length: 16, default: 'block' })
  action!: ComplianceWordAction;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;
}
