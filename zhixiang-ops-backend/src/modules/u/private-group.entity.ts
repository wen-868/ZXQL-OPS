import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { PrivateGroupType } from './u.types';

/**
 * 私域群（规划 §4-U，合规边界 §11②）。
 * - members 仅存粉丝公开ID（fans_public_ids），经企微/微信合规承接；不存个体隐私。
 */
@Entity({ name: 'ops_private_groups' })
@Index(['tenantId', 'type'])
export class PrivateGroupEntity extends BaseEntity {
  @Column({ name: 'name', type: 'varchar', length: 255, comment: '群名称' })
  name!: string;

  @Column({ name: 'members', type: 'json', nullable: true, comment: '成员公开ID列表（仅公开ID）' })
  members?: string[] | null;

  @Column({
    name: 'type',
    type: 'varchar',
    length: 32,
    default: 'wecom',
    comment: '类型: wecom/wechat',
  })
  type!: PrivateGroupType;
}
