import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';

export const ROLE_TABLE = 'ops_roles';

/**
 * 角色（RBAC）。
 * 一个角色绑定一组权限点（permissions: string[]），
 * 通过 ops_role_user 与用户建立多对多关系。
 */
@Entity({ name: ROLE_TABLE })
export class RoleEntity extends BaseEntity {
  @Column({ name: 'name', type: 'varchar', length: 64, comment: '角色名' })
  name!: string;

  @Column({
    name: 'description',
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: '角色描述',
  })
  description?: string;

  @Column({
    name: 'permissions',
    type: 'json',
    comment: '权限点集合（string[]，如 ["account:read","role:manage"]）',
  })
  permissions!: string[];

  @Column({
    name: 'is_system',
    type: 'boolean',
    default: false,
    comment: '是否系统内置角色（内置角色不可删除）',
  })
  isSystem!: boolean;
}
