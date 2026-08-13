import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../database/base.entity';
import { SkillType } from './skill.types';

/**
 * 能力调用用量日志（规划 §4-O）。
 * 记录每次技能调用的租户/技能/来源/模型/tokens/耗时/成败，用于计费与降级分析。
 * 写入为 best-effort（失败不阻塞主链路）。
 */
@Entity({ name: 'skill_usage_logs' })
export class SkillUsageLog extends BaseEntity {
  @Column({ type: 'varchar', length: 32, comment: '技能类型' })
  skill!: SkillType;

  @Column({ type: 'varchar', length: 32, comment: '来源' })
  source!: string;

  @Column({ name: 'model_used', type: 'varchar', length: 64, comment: '实际模型' })
  modelUsed!: string;

  @Column({ name: 'tokens', type: 'int', default: 0, comment: '消耗 token' })
  tokens!: number;

  @Column({ name: 'latency_ms', type: 'int', default: 0, comment: '耗时(ms)' })
  latencyMs!: number;

  @Column({ name: 'ok', type: 'boolean', default: true, comment: '是否成功' })
  ok!: boolean;
}
