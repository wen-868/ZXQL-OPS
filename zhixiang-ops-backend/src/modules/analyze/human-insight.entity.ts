import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';

/**
 * 洞察知识库实体（规划 §4-D / ops_human_insights）。
 * 存储沉淀的人性洞察，供选题（E）检索复用；支持去重与引用计数。
 * 仅存聚合结论，不含个人信息（合规边界②）。
 */
@Entity('ops_human_insights')
export class HumanInsightEntity extends BaseEntity {
  /** 归类（通常等同于 driver，便于多维检索） */
  @Column({ type: 'varchar', length: 32 })
  category: string;

  /** 人性标签（7 选 1） */
  @Index()
  @Column({ type: 'varchar', length: 16 })
  driver: string;

  /** 情绪标签（6 选 1） */
  @Index()
  @Column({ type: 'varchar', length: 16 })
  emotion: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'json', nullable: true })
  tags?: string[];

  /** 关联关系分析任务（自动聚类沉淀时回填） */
  @Index()
  @Column({ type: 'bigint', nullable: true })
  refAnalysisId?: number;

  /** 被报告/选题引用次数（自增） */
  @Column({ type: 'int', default: 0 })
  usageCount: number;
}
