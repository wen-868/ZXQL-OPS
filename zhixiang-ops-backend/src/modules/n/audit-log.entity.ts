import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';

export const AUDIT_LOG_TABLE = 'ops_audit_logs';

/**
 * 操作审计日志。
 * 由 AuditService.record 写入，供全局操作审计（规划 N 消费契约"操作审计：全局记录"）。
 */
@Entity({ name: AUDIT_LOG_TABLE })
export class AuditLogEntity extends BaseEntity {
  @Column({
    name: 'user_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
    comment: '操作者用户ID',
  })
  userId?: number;

  @Column({
    name: 'action',
    type: 'varchar',
    length: 64,
    comment: '操作类型，如 create_role / assign_role',
  })
  action!: string;

  @Column({
    name: 'module',
    type: 'varchar',
    length: 32,
    comment: '所属模块，如 role / audit / account',
  })
  module!: string;

  @Column({
    name: 'resource',
    type: 'varchar',
    length: 128,
    nullable: true,
    comment: '操作对象标识，如 roleId:12',
  })
  resource?: string;

  @Column({ name: 'trace_id', type: 'varchar', length: 64, nullable: true, comment: '链路追踪号' })
  traceId?: string;

  @Column({ name: 'ts', type: 'datetime', default: () => 'CURRENT_TIMESTAMP', comment: '操作时间' })
  ts!: Date;
}
