import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';

/** 工单状态：open 待处理 / pending 处理中 / resolved 已解决 / closed 已关闭 */
export type TicketStatus = 'open' | 'pending' | 'resolved' | 'closed';
/** 工单优先级 */
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

/**
 * 转人工工单（ops_support_tickets）。
 * 低置信度/高风险意图由 AI 自动转人工，或由用户/运营显式转人工。
 */
@Entity({ name: 'ops_support_tickets' })
@Index('idx_cs_ticket_tenant_status', ['tenantId', 'status'])
@Index('idx_cs_ticket_tenant_priority', ['tenantId', 'priority'])
export class SupportTicketEntity extends BaseEntity {
  @Column({
    name: 'session_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
    comment: '关联会话',
  })
  sessionId?: number | null;

  @Column({
    name: 'buyer_ref',
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: '买家匿名引用（加密）',
  })
  buyerRef?: string | null;

  @Column({ name: 'issue', type: 'text', comment: '问题摘要' })
  issue!: string;

  @Column({ name: 'status', type: 'varchar', length: 16, default: 'open', comment: '工单状态' })
  status!: TicketStatus;

  @Column({ name: 'priority', type: 'varchar', length: 12, default: 'medium', comment: '优先级' })
  priority!: TicketPriority;

  @Column({
    name: 'assigned_to',
    type: 'bigint',
    unsigned: true,
    nullable: true,
    comment: '指派客服',
  })
  assignedTo?: number | null;
}
