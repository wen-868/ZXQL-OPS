import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * 管理系统→运营系统角色映射（对接方案 §5.3）。
 * SSO 登录时按管理系统 roles[] 映射运营角色与菜单范围。
 */
@Entity('ops_role_bind')
export class RoleBind {
  @PrimaryGeneratedColumn()
  id: number;

  /** 管理系统角色码 */
  @Index({ unique: true })
  @Column({ name: 'ms_role', type: 'varchar', length: 64 })
  msRole: string;

  /** 运营系统角色（super_admin / ops_admin / ops_viewer） */
  @Column({ name: 'ops_role', type: 'varchar', length: 64 })
  opsRole: string;

  /** 菜单范围：all / ms / ops / readonly */
  @Column({ name: 'menu_scope', type: 'varchar', length: 255, default: 'ops' })
  menuScope: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
