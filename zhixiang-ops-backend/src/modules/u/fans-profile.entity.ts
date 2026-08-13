import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { FansSource } from './u.types';

/**
 * 粉丝画像（规划 §4-U，合规边界 §11②）。
 * - 仅存聚合分布(interact_agg JSON)与公开字段(public_id)；不落个体隐私（禁精准地理位置/个体画像）。
 * - tags 为分层标签；source 区分聚合/授权/公开。
 */
@Entity({ name: 'ops_fans_profiles' })
@Index(['tenantId', 'platform'])
@Index(['tenantId', 'source'])
export class FansProfileEntity extends BaseEntity {
  @Column({ name: 'platform', type: 'varchar', length: 32, comment: '平台' })
  platform!: string;

  @Column({ name: 'public_id', type: 'varchar', length: 128, comment: '平台侧公开ID（非隐私）' })
  publicId!: string;

  @Column({ name: 'level', type: 'varchar', length: 32, default: 'normal', comment: '分层等级' })
  level!: string;

  @Column({
    name: 'interact_agg',
    type: 'json',
    nullable: true,
    comment: '互动聚合分布（仅聚合，不含个体）',
  })
  interactAgg?: Record<string, unknown> | null;

  @Column({ name: 'tags', type: 'json', nullable: true, comment: '分层标签' })
  tags?: string[] | null;

  @Column({
    name: 'source',
    type: 'varchar',
    length: 32,
    default: 'aggregate',
    comment: '来源: aggregate/authorized/public',
  })
  source!: FansSource;
}
