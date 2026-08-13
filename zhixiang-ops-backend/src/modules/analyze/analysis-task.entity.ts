import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { AnalysisSource, AnalysisStatus, AnalyzeInsight } from './analyze.types';

/**
 * 人性分析任务实体（规划 §4-D / ops_analysis_tasks）。
 * 消费 C 清洗后的干净评论（is_clean=true），经能力网关做 7×6 归因聚类，
 * 仅持久化聚合统计（driverCounts / emotionScores / topDrivers / topEmotions / insights），
 * 不留存任何单条个人信息（合规边界②）。
 */
@Entity('ops_analysis_tasks')
export class AnalysisTaskEntity extends BaseEntity {
  /** 分析来源：评论 / 直播 / 投放 */
  @Column({ type: 'varchar', length: 16, default: AnalysisSource.Comments })
  source: AnalysisSource;

  /** 指定平台（可选；为空表示跨平台） */
  @Column({ type: 'varchar', length: 32, nullable: true })
  platform?: string;

  /** 指定分析来源引用（评论 source_ref 列表）；为空则消费全部 is_clean 评论 */
  @Column({ type: 'json', nullable: true })
  inputRefs?: string[];

  @Index()
  @Column({ type: 'varchar', length: 16, default: AnalysisStatus.Pending })
  status: AnalysisStatus;

  @Column({ type: 'int', default: 0 })
  progress: number;

  /** 实际参与分析的评论条数 */
  @Column({ type: 'int', default: 0 })
  totalComments: number;

  /** 7 人性命中计数（聚合） */
  @Column({ type: 'json', nullable: true })
  driverCounts?: Record<string, number>;

  /** 6 情绪强度计分（聚合） */
  @Column({ type: 'json', nullable: true })
  emotionScores?: Record<string, number>;

  /** 按 driverCounts 降序取前 3 人性 */
  @Column({ type: 'json', nullable: true })
  topDrivers?: string[];

  /** 按 emotionScores 降序取前 3 情绪 */
  @Column({ type: 'json', nullable: true })
  topEmotions?: string[];

  /** 洞察列表（聚合 + 知识库沉淀） */
  @Column({ type: 'json', nullable: true })
  insights?: AnalyzeInsight[];

  /** 实际使用的模型（内部记录，对 UX 透明） */
  @Column({ type: 'varchar', length: 64, default: '' })
  modelUsed: string;

  /** 聚类 prompt 版本（便于回溯） */
  @Column({ type: 'varchar', length: 32, default: 'v1' })
  promptVersion: string;

  @Column({ type: 'text', nullable: true })
  errorMsg?: string;

  @Column({ type: 'timestamp', nullable: true })
  finishedAt?: Date;
}
