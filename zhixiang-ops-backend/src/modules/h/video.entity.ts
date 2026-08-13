import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';

/** 智能成片（规划 §4-H / 阶段3 增强）。视频资产：脚本转分镜+FFmpeg 剪辑成片，多比例，送审+合规预检，与 F 脚本/G 素材/K 拆条联动 */
@Entity('ops_videos')
@Index('idx_videos_tenant', ['tenantId'])
@Index('idx_videos_tenant_script', ['tenantId', 'scriptId'])
export class VideoEntity extends BaseEntity {
  /** 关联脚本（F scripts.id） */
  @Column({ type: 'bigint', comment: '关联脚本 F scripts.id' })
  scriptId!: number;

  /** 素材 G materials.id 列表 */
  @Column({ type: 'json', nullable: true, comment: '素材 G materials.id 列表' })
  materialIds?: number[] | null;

  @Column({ type: 'varchar', length: 16, nullable: true, comment: '比例 9:16/1:1 等' })
  ratio?: string | null;

  @Column({ type: 'int', nullable: true, comment: '时长(秒)' })
  duration?: number | null;

  /** 成片地址（MinIO，FFmpeg 合成后回写） */
  @Column({ type: 'varchar', length: 512, nullable: true, comment: '成片地址 MinIO' })
  url?: string | null;

  @Column({
    type: 'varchar',
    length: 32,
    default: 'pending',
    comment: '送审 status pending/reviewing/passed/rejected',
  })
  reviewStatus!: string;

  @Column({
    type: 'varchar',
    length: 32,
    default: 'draft',
    comment: '成片 status draft/editing/done',
  })
  status!: string;

  @Column({ type: 'varchar', length: 255, nullable: true, comment: '标题' })
  title?: string | null;

  @Column({ type: 'json', nullable: true, comment: '生成详情(分镜/剪辑命令/合规命中)' })
  meta?: Record<string, unknown> | null;
}
