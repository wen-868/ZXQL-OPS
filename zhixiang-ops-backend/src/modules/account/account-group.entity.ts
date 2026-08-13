import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { Platform } from './account.types';

/**
 * 账号分组实体（规划 §4-B / B-advanced 分组管理）。
 * 按名称分组归档账号；platform 可限定（NULL=跨平台）。
 * 同租户下组名唯一，删除为软删（组内账号 groupId 置空）。
 */
@Entity({ name: 'ops_account_groups' })
@Index(['tenantId', 'name'], { unique: true })
export class AccountGroupEntity extends BaseEntity {
  @Column({ name: 'name', type: 'varchar', length: 64, comment: '分组名称' })
  name!: string;

  @Column({
    name: 'platform',
    type: 'varchar',
    length: 32,
    nullable: true,
    comment: '平台限定（NULL=跨平台）',
  })
  platform?: Platform;

  @Column({ name: 'sort_order', type: 'int', default: 0, comment: '排序（小的在前）' })
  sortOrder!: number;

  @Column({
    name: 'description',
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: '分组说明',
  })
  description?: string;
}
