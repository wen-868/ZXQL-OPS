import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * 管理系统↔运营系统租户映射（对接方案 §5.2）。
 * SSO 登录时把管理系统 tenantId 转换为运营 tenantId（默认 t_dev）。
 */
@Entity('ops_tenant_bind')
export class TenantBind {
  @PrimaryGeneratedColumn()
  id: number;

  /** 管理系统租户标识 */
  @Index({ unique: true })
  @Column({ name: 'ms_tenant_id', type: 'varchar', length: 64 })
  msTenantId: string;

  /** 运营系统租户标识 */
  @Index()
  @Column({ name: 'ops_tenant_id', type: 'varchar', length: 64 })
  opsTenantId: string;

  /** 1=启用 0=停用 */
  @Column({ type: 'tinyint', default: 1 })
  status: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
