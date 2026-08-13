import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';

export const ROLE_USER_TABLE = 'ops_role_user';

/**
 * 用户-角色绑定（RBAC 多对多中间表）。
 * user_id 来自管理系统 SSO 透传（运营系统不持有用户表），
 * 同一租户下 (tenantId, userId, roleId) 唯一。
 */
@Entity({ name: ROLE_USER_TABLE })
@Index(['tenantId', 'userId', 'roleId'], { unique: true })
export class RoleUserEntity extends BaseEntity {
  @Column({
    name: 'user_id',
    type: 'bigint',
    unsigned: true,
    comment: '用户ID（管理系统 SSO 透传）',
  })
  userId!: number;

  @Column({ name: 'role_id', type: 'bigint', unsigned: true, comment: '角色ID' })
  roleId!: number;
}
