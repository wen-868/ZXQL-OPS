import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { TopicStatus } from './topic.types';

/**
 * 选题实体（规划 §4-E / ops_topics）。
 * 由 D 洞察库（或指定分析任务）聚合生成；承载归因标识、人性/情绪标签、
 * 公式标签、状态机、综合评分、A/B 变体关联、排期绑定。
 * 仅存聚合洞察结论与选题元数据，不含个人信息（合规边界②）。
 */
@Entity('ops_topics')
export class TopicEntity extends BaseEntity {
  /** 关联的人性分析任务（D.analysis_tasks），可为空（直接由洞察库生成） */
  @Index()
  @Column({ type: 'bigint', nullable: true })
  analysisId?: number;

  /** 全局归因标识（attr_<tenant>_content_<hash32>），源头生成、下游只读透传 */
  @Index()
  @Column({ type: 'varchar', length: 128 })
  attributionId: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  /** 人性标签（7 选 1） */
  @Index()
  @Column({ type: 'varchar', length: 16 })
  humanDriver: string;

  /** 情绪标签（6 选 1） */
  @Index()
  @Column({ type: 'varchar', length: 16 })
  emotion: string;

  /** 公式标签（由洞察 tags 聚合而来） */
  @Column({ type: 'json', nullable: true })
  formulaTags?: string[];

  /** 状态机：idea→todo→written→shot→published，外加 dead */
  @Index()
  @Column({ type: 'varchar', length: 16, default: TopicStatus.Idea })
  status: TopicStatus;

  /** 综合评分（洞察复用度 + 人性/情绪权重聚合，0–100） */
  @Column({ type: 'int', default: 0 })
  score: number;

  /** A/B 变体基准选题 id（自引用，空表示原创选题） */
  @Index()
  @Column({ type: 'bigint', nullable: true })
  abVariantOf?: number;

  /** 排期发布时间 */
  @Column({ type: 'timestamp', nullable: true })
  scheduledAt?: Date;

  /** 排期绑定账号（B.accounts），可为空（未指定账号） */
  @Index()
  @Column({ type: 'bigint', nullable: true })
  accountId?: number;

  /** 选题 prompt 版本（便于回溯） */
  @Column({ type: 'varchar', length: 32, default: 'v1' })
  promptVersion: string;

  /** 实际使用的模型（预留，对 UX 透明） */
  @Column({ type: 'varchar', length: 64, default: '' })
  modelUsed: string;
}
