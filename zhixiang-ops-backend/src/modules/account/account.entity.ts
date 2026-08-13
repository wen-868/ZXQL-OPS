import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { AccountIdentity, AccountStage, AccountStatus, Platform } from './account.types';

/**
 * 账号矩阵实体（规划 §4-B / 开发顺序设计.md 的 B-core）。
 * - 一张表承载多平台账号（platform 区分），同一租户下 (platform, platformAccountId) 唯一。
 * - 身份/赛道/阶段用于矩阵分组管理；status 为健康状态，由 Token 有效期 + 平台信号驱动。
 * - access/refresh token 加密存储（tokenEnc / refreshTokenEnc），明文不落库。
 * - 粉丝/关注/获赞为快照，由采集模块（C）或手动同步更新。
 */
@Entity({ name: 'ops_accounts' })
@Index(['tenantId', 'platform', 'platformAccountId'], { unique: true })
export class AccountEntity extends BaseEntity {
  @Column({ name: 'platform', type: 'varchar', length: 32, comment: '平台' })
  platform!: Platform;

  @Column({
    name: 'platform_account_id',
    type: 'varchar',
    length: 128,
    comment: '平台侧账号唯一ID',
  })
  platformAccountId!: string;

  @Column({ name: 'nickname', type: 'varchar', length: 128, nullable: true, comment: '昵称' })
  nickname?: string;

  @Column({ name: 'avatar_url', type: 'varchar', length: 512, nullable: true, comment: '头像URL' })
  avatarUrl?: string;

  @Column({
    name: 'identity',
    type: 'varchar',
    length: 32,
    default: 'matrix',
    comment: '身份: primary/secondary/matrix',
  })
  identity!: AccountIdentity;

  @Column({ name: 'track', type: 'varchar', length: 64, nullable: true, comment: '赛道' })
  track?: string;

  @Column({
    name: 'stage',
    type: 'varchar',
    length: 32,
    default: 'nurturing',
    comment: '阶段: nurturing/growing/mature/declining',
  })
  stage!: AccountStage;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 32,
    default: 'unsigned',
    comment: '健康状态: normal/warning/risk/unsigned/banned',
  })
  status!: AccountStatus;

  /** 加密的 access token（AES-256-GCM） */
  @Column({ name: 'token_enc', type: 'text', nullable: true, comment: '加密的 access token' })
  tokenEnc?: string;

  /** OAuth open_id（抖音/快手等平台侧用户唯一标识；发布必传） */
  @Column({
    name: 'platform_open_id',
    type: 'varchar',
    length: 128,
    nullable: true,
    comment: 'OAuth open_id',
  })
  platformOpenId?: string;

  /** 加密的 refresh token */
  @Column({
    name: 'refresh_token_enc',
    type: 'text',
    nullable: true,
    comment: '加密的 refresh token',
  })
  refreshTokenEnc?: string;

  @Column({ name: 'token_expire_at', type: 'datetime', nullable: true, comment: 'token 过期时间' })
  tokenExpireAt?: Date;

  @Column({ name: 'last_sync_at', type: 'datetime', nullable: true, comment: '最后同步资料时间' })
  lastSyncAt?: Date;

  @Column({ name: 'last_active_at', type: 'datetime', nullable: true, comment: '最后活跃时间' })
  lastActiveAt?: Date;

  @Column({ name: 'fans_count', type: 'int', default: 0, comment: '粉丝数快照' })
  fansCount!: number;

  @Column({ name: 'follow_count', type: 'int', default: 0, comment: '关注数快照' })
  followCount!: number;

  @Column({ name: 'like_count', type: 'int', default: 0, comment: '获赞数快照' })
  likeCount!: number;

  @Column({ name: 'remark', type: 'varchar', length: 255, nullable: true, comment: '备注' })
  remark?: string;

  @Column({
    name: 'group_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
    comment: '所属分组ID（B-advanced 分组管理）',
  })
  groupId?: number | null;

  @Column({ name: 'persona', type: 'varchar', length: 64, nullable: true, comment: '人设定位' })
  persona?: string;

  @Column({
    name: 'health_score',
    type: 'tinyint',
    unsigned: true,
    nullable: true,
    comment: '健康分 0-100（巡检沉淀，matrix 展示）',
  })
  healthScore?: number | null;
}
