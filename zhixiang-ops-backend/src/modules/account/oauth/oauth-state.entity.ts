import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';

/**
 * OAuth 授权 state 记录（规划 §4-B / B-core OAuth 接入）。
 * 防 CSRF：state 一次性（used=1 后作废）、10 分钟过期、携带租户与回调地址。
 */
@Entity({ name: 'ops_account_oauth_states' })
@Index(['tenantId', 'expiresAt'])
export class AccountOAuthStateEntity extends BaseEntity {
  @Column({ name: 'state', type: 'varchar', length: 64, comment: '随机 state（防 CSRF）' })
  state!: string;

  @Column({ name: 'platform', type: 'varchar', length: 32, comment: '平台' })
  platform!: string;

  @Column({
    name: 'redirect_uri',
    type: 'varchar',
    length: 512,
    nullable: true,
    comment: '回调地址',
  })
  redirectUri?: string;

  @Column({ name: 'used', type: 'boolean', default: false, comment: '是否已使用（一次性）' })
  used!: boolean;

  @Column({ name: 'expires_at', type: 'datetime', comment: '过期时间' })
  expiresAt!: Date;
}
