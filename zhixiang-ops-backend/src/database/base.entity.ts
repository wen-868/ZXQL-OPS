import {
  BeforeInsert,
  CreateDateColumn,
  DeleteDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Column,
} from 'typeorm';
import { TenantContext } from '../tenant/tenant-context';

/**
 * 实体基类（对齐管理系统 ai-base 的 BaseEntity 约定）。
 * - id 主键
 * - tenantId 多租户隔离字段（所有业务表必须有）
 * - createdAt / updatedAt / deletedAt（软删除）
 *
 * 强隔离：@BeforeInsert 自动从 TenantContext 注入 tenantId，防止业务层漏填导致
 * 跨租户数据串号。若上下文中无 tenantId（如系统内部任务），交由调用方显式赋值，
 * 仍缺失则插入时由 NOT NULL 约束报错，不静默写空。
 */
export abstract class BaseEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: number;

  @Column({ name: 'tenant_id', type: 'varchar', length: 36, comment: '租户ID' })
  tenantId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', comment: '创建时间' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', comment: '更新时间' })
  updatedAt!: Date;

  @DeleteDateColumn({
    name: 'deleted_at',
    type: 'datetime',
    nullable: true,
    comment: '删除时间（软删）',
  })
  deletedAt?: Date;

  @BeforeInsert()
  protected fillTenantId(): void {
    if (!this.tenantId) {
      const tid = TenantContext.getTenantId();
      if (tid) {
        this.tenantId = tid;
      }
    }
  }
}
