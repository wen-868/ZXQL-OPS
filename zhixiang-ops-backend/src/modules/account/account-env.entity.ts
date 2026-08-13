import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { IsolateProvider } from './dto/configure-account-env.dto';

/**
 * 账号环境隔离配置（规划 §4-B / B-advanced）。
 * 记录每个账号的指纹 / 出口 IP / 设备标识，用于防关联（关联度评估）。
 * 与 ops_accounts 为 1:1（按 tenantId+accountId 唯一），B-core 已在阶段1 完成。
 */
@Entity({ name: 'ops_account_envs' })
@Index(['tenantId', 'accountId'], { unique: true })
export class AccountEnvEntity extends BaseEntity {
  @Column({ name: 'account_id', type: 'bigint', unsigned: true, comment: '关联账号ID' })
  accountId!: number;

  @Column({
    name: 'fingerprint',
    type: 'varchar',
    length: 256,
    nullable: true,
    comment: '浏览器指纹',
  })
  fingerprint?: string;

  @Column({ name: 'ip', type: 'varchar', length: 64, nullable: true, comment: '出口IP' })
  ip?: string;

  @Column({ name: 'device', type: 'varchar', length: 256, nullable: true, comment: '设备标识' })
  device?: string;

  @Column({ name: 'env_isolated', type: 'boolean', default: false, comment: '是否已做环境隔离' })
  envIsolated!: boolean;

  @Column({
    name: 'isolate_provider',
    type: 'varchar',
    length: 32,
    default: 'none',
    comment: '隔离方式: none/fingerprint_browser/proxy_ip/device_sandbox',
  })
  isolateProvider!: IsolateProvider;
}
