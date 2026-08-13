import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * 运营系统本地用户（独立模式）。
 * 独立部署时使用用户名+密码登录；连通模式由管理系统 SSO 统一签发 token。
 */
@Entity('ops_users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  /** 登录用户名（唯一） */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  username: string;

  /** bcrypt 哈希密码 */
  @Column({ type: 'varchar', length: 128, select: false })
  password: string;

  /** 显示名 */
  @Column({ name: 'real_name', type: 'varchar', length: 64, nullable: true })
  realName?: string;

  /** 角色（admin / editor / viewer） */
  @Column({ type: 'varchar', length: 32, default: 'admin' })
  role: string;

  /** 所属租户 */
  @Column({ name: 'tenant_id', type: 'varchar', length: 64, default: 't_dev' })
  tenantId: string;

  /** 用户类型 */
  @Column({ type: 'varchar', length: 32, default: 'standalone' })
  type: string;

  /** 账号状态：1=启用 0=禁用（员工管理使用） */
  @Column({
    name: 'status',
    type: 'tinyint',
    width: 1,
    default: 1,
    comment: '账号状态 1=启用 0=禁用',
  })
  status: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
