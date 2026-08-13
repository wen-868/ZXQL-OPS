import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';

/** 账号风险类型：关联 / 限流 / 封号 */
export type AccountRiskType = '关联' | '限流' | '封号';

/**
 * 账号风险日志（规划 §4-B / B-advanced）。
 * 记录矩阵关联风险（防关联评估命中）、平台限流 / 封号等风险事件，供增强看板时间线使用。
 */
@Entity({ name: 'ops_account_risk_logs' })
@Index(['tenantId', 'accountId', 'loggedAt'])
export class AccountRiskLogEntity extends BaseEntity {
  @Column({ name: 'account_id', type: 'bigint', unsigned: true, comment: '关联账号ID' })
  accountId!: number;

  @Column({ name: 'risk_type', type: 'varchar', length: 32, comment: '风险类型: 关联/限流/封号' })
  riskType!: AccountRiskType;

  @Column({ name: 'score', type: 'int', default: 0, comment: '风险评分 0-100' })
  score!: number;

  @Column({ name: 'detail', type: 'varchar', length: 512, nullable: true, comment: '风险说明' })
  detail?: string;

  @Column({ name: 'logged_at', type: 'datetime', comment: '记录时间' })
  loggedAt!: Date;
}
