import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';

/**
 * 直播弹幕（规划 §4-K）。
 * - is_ai_reply 标记该弹幕是否触发 AI 应答；ai_reply 为 AI 生成回复。
 */
@Entity({ name: 'ops_live_danmu' })
@Index(['tenantId', 'roomId'])
export class LiveDanmuEntity extends BaseEntity {
  @Column({ name: 'room_id', type: 'int', comment: '直播间 id' })
  roomId!: number;

  @Column({ name: 'content', type: 'varchar', length: 1024, comment: '弹幕内容' })
  content!: string;

  @Column({ name: 'is_ai_reply', type: 'boolean', default: false, comment: '是否触发 AI 应答' })
  isAiReply!: boolean;

  @Column({
    name: 'ai_reply',
    type: 'varchar',
    length: 1024,
    nullable: true,
    comment: 'AI 回复内容',
  })
  aiReply?: string | null;

  @Column({ name: 'ts', type: 'datetime', comment: '弹幕时间' })
  ts!: Date;
}
