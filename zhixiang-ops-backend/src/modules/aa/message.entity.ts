import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';

/** 消息角色：user 买家 / ai 机器人 / agent 人工客服 */
export type CsMessageRole = 'user' | 'ai' | 'agent';

/**
 * 客服消息（ops_customer_messages）。
 * 每条用户消息触发一次 AI 回复（role=ai），或转人工后由人工回复（role=agent）。
 */
@Entity({ name: 'ops_customer_messages' })
@Index('idx_cs_msg_tenant_session', ['tenantId', 'sessionId'])
export class CustomerMessageEntity extends BaseEntity {
  @Column({ name: 'session_id', type: 'bigint', unsigned: true, comment: '所属会话' })
  sessionId!: number;

  @Column({ name: 'role', type: 'varchar', length: 12, comment: '消息角色' })
  role!: CsMessageRole;

  @Column({ name: 'content', type: 'text', comment: '消息内容' })
  content!: string;

  @Column({
    name: 'intent',
    type: 'varchar',
    length: 32,
    nullable: true,
    comment: '识别意图（order/logistics/product/faq/unknown）',
  })
  intent?: string | null;

  @Column({ name: 'confidence', type: 'float', nullable: true, comment: '意图置信度 0~1' })
  confidence?: number | null;
}
