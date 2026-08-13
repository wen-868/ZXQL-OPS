import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * 系统配置（配置中心，运营后台「设置 → 系统配置」）。
 * 客户自决的外部服务凭据/参数（如抖音开放平台 OAuth、BYO 网关等），
 * 敏感值经 encryptSecret 加密后落库，对外仅返回掩码。
 */
@Entity({ name: 'ops_system_configs' })
export class SystemConfigEntity {
  @PrimaryColumn({ type: 'varchar', length: 64, comment: '配置键（白名单内）' })
  key!: string;

  /** 非敏感明文值 */
  @Column({ name: 'value_text', type: 'text', nullable: true, comment: '非敏感明文值' })
  valueText?: string | null;

  /** 敏感值（加密存储） */
  @Column({ name: 'value_enc', type: 'text', nullable: true, comment: '敏感值（加密存储）' })
  valueEnc?: string | null;

  @Column({ name: 'is_sensitive', type: 'boolean', default: false, comment: '是否敏感（加密）' })
  isSensitive!: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true, comment: '配置说明' })
  description?: string | null;

  @Column({
    name: 'updated_at',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP(6)',
    onUpdate: 'CURRENT_TIMESTAMP(6)',
  })
  updatedAt!: Date;
}
