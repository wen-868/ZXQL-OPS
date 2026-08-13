import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { AccountHealthEventType, AccountStatus } from './account.types';

/**
 * 账号健康事件（规划 §4-B / B-core 的账号健康监控）。
 * 记录掉签 / 限流 / 降权 / 恢复 / 封禁 / 重新授权等状态变化，供矩阵健康看板时间线使用。
 */
@Entity({ name: 'ops_account_health_events' })
@Index(['tenantId', 'accountId', 'createdAt'])
export class AccountHealthEventEntity extends BaseEntity {
  @Column({ name: 'account_id', type: 'bigint', unsigned: true, comment: '关联账号ID' })
  accountId!: number;

  @Column({ name: 'event_type', type: 'varchar', length: 32, comment: '事件类型' })
  eventType!: AccountHealthEventType;

  @Column({
    name: 'prev_status',
    type: 'varchar',
    length: 32,
    nullable: true,
    comment: '变更前状态',
  })
  prevStatus?: AccountStatus;

  @Column({
    name: 'next_status',
    type: 'varchar',
    length: 32,
    nullable: true,
    comment: '变更后状态',
  })
  nextStatus?: AccountStatus;

  @Column({ name: 'detail', type: 'varchar', length: 512, nullable: true, comment: '事件说明' })
  detail?: string;
}
