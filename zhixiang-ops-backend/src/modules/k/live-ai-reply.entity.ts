import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { LiveAiReplyStatus } from './k.types';

/**
 * 弹幕 AI 应答记录（规划 §4-K）。
 * - status: auto(自动应答) / pending(待人工确认)。
 */
@Entity({ name: 'ops_live_ai_replies' })
@Index(['tenantId', 'roomId'])
@Index(['tenantId', 'status'])
export class LiveAiReplyEntity extends BaseEntity {
  @Column({ name: 'room_id', type: 'int', comment: '直播间 id' })
  roomId!: number;

  @Column({ name: 'question', type: 'varchar', length: 1024, comment: '弹幕问题' })
  question!: string;

  @Column({ name: 'answer', type: 'varchar', length: 2048, nullable: true, comment: 'AI 回复' })
  answer?: string | null;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 16,
    default: 'auto',
    comment: '状态: auto/pending',
  })
  status!: LiveAiReplyStatus;
}
