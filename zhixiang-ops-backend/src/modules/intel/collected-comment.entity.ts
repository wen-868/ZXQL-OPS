import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { CollectSourceType } from './intel.types';

/**
 * 采集评论实体（规划 §4-C / ops_collected_comments）。
 * 仅存公开情报字段白名单：content / author_id(平台公开ID) / likes / platform / source_ref / collected_at。
 * 命中隐私（手机/地理/IMEI）一律剥离为 [已脱敏] 并记 clean_result；
 * 命中广告词或隐私则 is_clean=false，供 D 人性分析只消费干净数据。
 */
@Entity('ops_collected_comments')
export class CollectedCommentEntity extends BaseEntity {
  @Index()
  @Column({ type: 'varchar', length: 32 })
  platform: string;

  @Column({ name: 'source_type', type: 'varchar', length: 32, default: 'comment' })
  sourceType: CollectSourceType;

  /** 来源引用（平台内容 ID / 链接） */
  @Column({ name: 'source_ref', type: 'varchar', length: 256 })
  sourceRef: string;

  @Column({ type: 'text' })
  content: string;

  /** 平台公开 ID（非个人私密资料，字段白名单强制） */
  @Column({ name: 'author_id', type: 'varchar', length: 128, nullable: true })
  authorId?: string;

  @Column({ type: 'int', default: 0 })
  likes: number;

  /** 是否通过清洗（无广告 / 无隐私命中） */
  @Column({ name: 'is_clean', type: 'boolean', default: true })
  isClean: boolean;

  /** 清洗结果 JSON：{ piiRemoved: string[], ad: boolean } */
  @Column({ name: 'clean_result', type: 'json', nullable: true })
  cleanResult?: Record<string, unknown>;

  /** 内容指纹（去重） */
  @Index()
  @Column({ name: 'content_hash', type: 'varchar', length: 64 })
  contentHash: string;

  @Column({ name: 'collected_at', type: 'timestamp' })
  collectedAt: Date;

  @Index()
  @Column({ name: 'task_id', type: 'varchar', length: 64, nullable: true })
  taskId?: string;
}
