import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';

/**
 * 直播实时统计（规划 §4-K）。
 * - online_count 在线人数、gmv 成交；attribution_id 随直播室透传，供 J 复盘贯通。
 */
@Entity({ name: 'ops_live_stats' })
@Index(['tenantId', 'roomId'])
export class LiveStatEntity extends BaseEntity {
  @Column({ name: 'room_id', type: 'int', comment: '直播间 id' })
  roomId!: number;

  @Column({ name: 'online_count', type: 'int', default: 0, comment: '在线人数' })
  onlineCount!: number;

  @Column({
    name: 'gmv',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    comment: '成交金额',
  })
  gmv!: number;

  @Column({ name: 'attribution_id', type: 'varchar', length: 96, comment: 'live 类归因标识' })
  attributionId!: string;

  @Column({ name: 'ts', type: 'datetime', comment: '统计时间' })
  ts!: Date;
}
