import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';

export type MaterialType = 'image' | 'video' | 'music' | 'subtitle' | 'sticker' | 'avatar';
export type MaterialSource = 'jimeng' | 'keling' | 'local' | 'upload';
export type MaterialStatus = 'pending' | 'generated' | 'uploaded' | 'failed';

/** 素材中心（规划 §4-G / 阶段3 增强）。统一素材资产：AI 生成/实拍上传/数字人/音乐音效/字幕贴纸，标签检索，与 F 脚本/H 成片联动 */
@Entity('ops_materials')
@Index('idx_materials_tenant', ['tenantId'])
@Index('idx_materials_tenant_type', ['tenantId', 'type'])
export class MaterialEntity extends BaseEntity {
  @Column({
    type: 'varchar',
    length: 20,
    comment: '素材类型 image/video/music/subtitle/sticker/avatar',
  })
  type!: MaterialType;

  @Column({ type: 'varchar', length: 20, comment: '来源 jimeng/keling/local/upload' })
  source!: MaterialSource;

  /** 存储地址（MinIO，§16）；上传/AI 生成地址由真实 Provider 回写，当前可为空 */
  @Column({ type: 'varchar', length: 512, nullable: true, comment: '存储地址 MinIO' })
  url?: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true, comment: '比例 9:16/1:1 等' })
  ratio?: string | null;

  @Column({ type: 'json', nullable: true, comment: '标签数组' })
  tags?: string[] | null;

  /** 关联脚本（F scripts.id），与 H 成片/F 脚本联动 */
  @Column({ type: 'bigint', nullable: true, comment: '关联脚本 F scripts.id' })
  relatedScriptId?: number | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'pending',
    comment: '状态 pending/generated/uploaded/failed',
  })
  status!: MaterialStatus;

  /** AI 生成详情（prompt/生成文本/provider，源透明）；上传类为空 */
  @Column({ type: 'json', nullable: true, comment: 'AI 生成详情(源透明)' })
  meta?: Record<string, unknown> | null;
}
