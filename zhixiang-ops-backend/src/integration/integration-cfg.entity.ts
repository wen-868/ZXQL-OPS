import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../database/base.entity';
import { IntegrationMode } from './adapters';

/**
 * 双模式接入配置（规划 §17）。
 * - integration_mode: standalone(独立自营) / connected(经 ZhixiangCore SSO 打通管理系统)
 * - 一条系统级记录（tenant_id 系统占位），运营系统启动与管理动作读取。
 */
@Entity({ name: 'core_integration_cfg' })
export class IntegrationCfg extends BaseEntity {
  @Column({
    name: 'integration_mode',
    type: 'varchar',
    length: 16,
    default: 'standalone',
    comment: '接入模式: standalone/connected',
  })
  integrationMode!: IntegrationMode;

  @Column({
    name: 'core_base_url',
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: '管理系统基址',
  })
  coreBaseUrl?: string;

  @Column({
    name: 'client_id',
    type: 'varchar',
    length: 64,
    nullable: true,
    comment: 'SSO 客户端ID',
  })
  clientId?: string;

  @Column({
    name: 'sync_enabled',
    type: 'tinyint',
    width: 1,
    default: 0,
    comment: '主数据同步总开关（客户自决，0=关 1=开）',
  })
  syncEnabled!: number;

  @Column({
    name: 'sync_products',
    type: 'tinyint',
    width: 1,
    default: 0,
    comment: '商品同步开关',
  })
  syncProducts!: number;

  @Column({
    name: 'sync_customers',
    type: 'tinyint',
    width: 1,
    default: 0,
    comment: '客户同步开关',
  })
  syncCustomers!: number;

  @Column({
    name: 'sync_inventory',
    type: 'tinyint',
    width: 1,
    default: 0,
    comment: '库存同步开关',
  })
  syncInventory!: number;

  @Column({
    name: 'sync_orders',
    type: 'tinyint',
    width: 1,
    default: 0,
    comment: '订单同步开关',
  })
  syncOrders!: number;
}
