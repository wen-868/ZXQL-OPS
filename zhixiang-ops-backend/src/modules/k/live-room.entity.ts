import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { LiveRoomType, LiveRoomStatus } from './k.types';

/**
 * 直播间（规划 §4-K）。
 * - account_id → B 账号矩阵（ops_accounts）；product_ids → R 商品（ops_products）。
 * - attribution_id 在建 room 时生成（live 类），沿链只读透传。
 */
@Entity({ name: 'ops_live_rooms' })
@Index(['tenantId', 'status'])
@Index(['tenantId', 'accountId'])
export class LiveRoomEntity extends BaseEntity {
  @Column({ name: 'type', type: 'varchar', length: 16, comment: '形态: real/digital' })
  type!: LiveRoomType;

  @Column({ name: 'platform', type: 'varchar', length: 32, comment: '平台' })
  platform!: string;

  @Column({ name: 'account_id', type: 'int', comment: '关联 B 账号矩阵 id' })
  accountId!: number;

  @Column({ name: 'rtmp_url', type: 'varchar', length: 512, nullable: true, comment: '推流地址' })
  rtmpUrl?: string | null;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 16,
    default: 'created',
    comment: '状态: created/live/ended',
  })
  status!: LiveRoomStatus;

  @Column({ name: 'title', type: 'varchar', length: 255, nullable: true, comment: '直播标题' })
  title?: string | null;

  @Column({ name: 'product_ids', type: 'json', nullable: true, comment: '挂载 R 商品 id 列表' })
  productIds?: number[] | null;

  @Column({ name: 'attribution_id', type: 'varchar', length: 96, comment: 'live 类归因标识' })
  attributionId!: string;

  @Column({ name: 'started_at', type: 'datetime', nullable: true, comment: '开播时间' })
  startedAt?: Date | null;

  @Column({ name: 'ended_at', type: 'datetime', nullable: true, comment: '结束时间' })
  endedAt?: Date | null;
}
