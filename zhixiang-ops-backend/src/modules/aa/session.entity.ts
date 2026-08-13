import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';

/** 客服接入渠道（规划 AA：直播评论 / 私域 DM / 短视频评论 / 订单留言） */
export type CsChannel = 'live_comment' | 'private_dm' | 'short_video_comment' | 'order_message';
/** 会话状态：open 进行中 / transferred 已转人工 / closed 已关闭 */
export type CsSessionStatus = 'open' | 'transferred' | 'closed';

/**
 * 客服会话（ops_customer_sessions）。
 * 合规边界②：只存 buyer_ref 匿名引用（加密），不采集姓名/电话/地址等个体隐私。
 * 同租户同渠道同买家复用 open 会话（创建时查询复用，避免重复会话）。
 */
@Entity({ name: 'ops_customer_sessions' })
@Index('idx_cs_session_tenant_status', ['tenantId', 'status'])
@Index('idx_cs_session_tenant_channel', ['tenantId', 'channel'])
export class CustomerSessionEntity extends BaseEntity {
  @Column({ name: 'channel', type: 'varchar', length: 24, comment: '接入渠道' })
  channel!: CsChannel;

  @Column({
    name: 'buyer_ref',
    type: 'varchar',
    length: 255,
    comment: '买家匿名引用（加密，不存个体隐私）',
  })
  buyerRef!: string;

  @Column({
    name: 'related_order_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
    comment: '关联订单（订单留言/售后咨询）',
  })
  relatedOrderId?: number | null;

  @Column({
    name: 'related_product_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
    comment: '关联商品（商品咨询）',
  })
  relatedProductId?: number | null;

  @Column({ name: 'status', type: 'varchar', length: 16, default: 'open', comment: '会话状态' })
  status!: CsSessionStatus;

  @Column({
    name: 'last_message',
    type: 'varchar',
    length: 512,
    nullable: true,
    comment: '最近一条消息摘要',
  })
  lastMessage?: string | null;

  @Column({ name: 'message_count', type: 'int', unsigned: true, default: 0, comment: '消息数' })
  messageCount!: number;
}
