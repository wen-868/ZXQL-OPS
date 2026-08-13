import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { AdPlatform, AdAccountType, AdAccountStatus } from './s.types';

/**
 * 投放账户（规划 §4-S）。
 * - 千川/ADQ/小店通；auth 加密存储（tokenEnc），明文不落库。
 */
@Entity({ name: 'ops_ad_accounts' })
@Index(['tenantId', 'platform', 'type'])
export class AdAccountEntity extends BaseEntity {
  @Column({ name: 'platform', type: 'varchar', length: 32, comment: '平台' })
  platform!: AdPlatform;

  @Column({
    name: 'type',
    type: 'varchar',
    length: 32,
    comment: '类型: qianchuan/adq/xiaodian_tong',
  })
  type!: AdAccountType;

  /** 加密的鉴权凭据（AES-256-GCM） */
  @Column({ name: 'auth_enc', type: 'text', nullable: true, comment: '加密的投放账户鉴权凭据' })
  authEnc?: string | null;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 32,
    default: 'active',
    comment: '状态: active/expired/banned',
  })
  status!: AdAccountStatus;
}
