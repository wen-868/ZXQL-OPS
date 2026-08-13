import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';

/**
 * 客服设置（ops_cs_settings）。每租户单条配置（upsert 语义）。
 * enabled_channels 以 JSON 数组字符串存储（如 ["live_comment","private_dm"]）。
 */
@Entity({ name: 'ops_cs_settings' })
export class CsSettingsEntity extends BaseEntity {
  @Column({
    name: 'enabled_channels',
    type: 'varchar',
    length: 255,
    default: '["live_comment","private_dm","short_video_comment","order_message"]',
    comment: '启用渠道（JSON 数组）',
  })
  enabledChannels!: string;

  @Column({
    name: 'transfer_threshold',
    type: 'float',
    default: 0.5,
    comment: '转人工置信度阈值（低于则转人工）',
  })
  transferThreshold!: number;

  @Column({
    name: 'auto_reply_enabled',
    type: 'boolean',
    default: true,
    comment: '是否启用 AI 自动回复',
  })
  autoReplyEnabled!: boolean;

  @Column({ name: 'greeting', type: 'varchar', length: 512, nullable: true, comment: '欢迎语' })
  greeting?: string | null;

  @Column({
    name: 'working_hours',
    type: 'varchar',
    length: 64,
    nullable: true,
    comment: '营业时间描述',
  })
  workingHours?: string | null;
}
