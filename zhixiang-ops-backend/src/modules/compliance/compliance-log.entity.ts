import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { ComplianceHit } from './compliance.types';

/**
 * 合规预检日志（规划 §4-P）。
 * 每次 checkText 落一条：场景 / 命中 / 风险等级 / 评分 / 处置结果，供审计与复盘（J）消费。
 */
@Entity('compliance_logs')
export class ComplianceLogEntity extends BaseEntity {
  /** 预检场景：script / publish / live / aa / review */
  @Column({ type: 'varchar', length: 32, default: 'script' })
  scene!: string;

  @Column({ type: 'int', nullable: true })
  sourceId?: number | null;

  @Column({ type: 'text', nullable: true })
  text?: string;

  @Column({ type: 'json' })
  hits!: ComplianceHit[];

  @Column({ type: 'varchar', length: 16, default: 'none' })
  level!: string;

  @Column({ type: 'int', default: 0 })
  score!: number;

  /** 处置结果：pass / warn / block */
  @Column({ type: 'varchar', length: 16, default: 'pass' })
  result!: string;
}
