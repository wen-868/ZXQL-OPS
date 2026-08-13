import { BaseEntity } from '../../database/base.entity';
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { PublishStatus } from './publish.types';

/**
 * 发布任务实体（规划 §4-I / ops_publish_tasks）。
 * 消费 F 脚本（scriptId + attributionId 透传）；按账号(accountId→B)分发；
 * ext_post_id 为平台回执幂等键；cart_* 为挂车转化漏斗（阶段1 占位）。
 */
@Entity('ops_publish_tasks')
@Index('idx_publish_tenant_status', ['tenantId', 'status'])
@Index('idx_publish_tenant_script', ['tenantId', 'scriptId'])
@Index('idx_publish_tenant_account', ['tenantId', 'accountId'])
@Index('idx_publish_ext_post', ['tenantId', 'extPostId'])
export class PublishTaskEntity extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  /** 关联脚本（F ops_scripts.id） */
  @Column({ type: 'int' })
  scriptId!: number;

  /** 发布账号（B ops_accounts.id） */
  @Column({ type: 'int' })
  accountId!: number;

  /** 平台（取自账号 platform） */
  @Column({ type: 'varchar', length: 32 })
  platform!: string;

  /** 归因标识：直接复用 F 脚本的 attributionId，禁止在 I 重新生成 */
  @Column({ type: 'varchar', length: 64 })
  attributionId!: string;

  /** 视频资产 id（G/H 阶段3；阶段1 占位为 null） */
  @Column({ type: 'int', nullable: true })
  videoId?: number | null;

  @Column({ type: 'datetime', nullable: true })
  scheduledAt?: Date | null;

  @Column({ type: 'varchar', length: 32, default: PublishStatus.Queued })
  status!: PublishStatus;

  /** 指数退避重试次数 */
  @Column({ type: 'int', default: 0 })
  retryCount!: number;

  @Column({ type: 'varchar', length: 512, nullable: true })
  errorMsg?: string | null;

  /** 平台回执 id（幂等去重键） */
  @Column({ type: 'varchar', length: 128, nullable: true })
  extPostId?: string | null;

  /** 挂车商品 id（→ integration Product 适配层） */
  @Column({ type: 'varchar', length: 64, nullable: true })
  cartProductId?: string | null;

  /** 挂车点击数 */
  @Column({ type: 'int', default: 0 })
  cartClicks!: number;

  /** 下单转化数（经 Y 订单回写） */
  @Column({ type: 'int', default: 0 })
  orderConv!: number;

  @Column({ type: 'datetime', nullable: true })
  publishedAt?: Date | null;
}
