import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { env } from '../config/env';
import { AppError } from '../shared/app-error';
import { IntegrationCfg } from './integration-cfg.entity';
import { TenantBind } from './tenant-bind.entity';
import {
  AuthAdapter,
  CommissionAdapter,
  IntegrationMode,
  NotImplementedAdapter,
  OrderAdapter,
  ProductAdapter,
} from './adapters';
import { ConnectedAuthAdapter } from './connected-auth.adapter';
import { MsApiClient } from './ms-client';
import { ConnectedProductAdapter } from './connected-product.adapter';
import { ConnectedOrderAdapter } from './connected-order.adapter';
import { ConnectedCommissionAdapter } from './connected-commission.adapter';

/**
 * 双模式接入服务（规划 §17）。
 * - 读取接入模式（默认 standalone，独立自营）。
 * - 暴露四类适配器接口；standalone 模式统一为 NotImplementedAdapter（业务调用即抛 NOT_IMPLEMENTED）。
 * - connected 模式接入管理系统时，替换为真实实现（SSO / 商品 / 订单 / 佣金）。
 */
@Injectable()
export class IntegrationService {
  readonly mode: IntegrationMode;
  readonly adapters: {
    product: ProductAdapter;
    order: OrderAdapter;
    commission: CommissionAdapter;
    auth: AuthAdapter;
  };

  constructor(
    @InjectRepository(IntegrationCfg)
    private readonly cfgRepo?: Repository<IntegrationCfg>,
    @InjectRepository(TenantBind)
    private readonly tenantBindRepo?: Repository<TenantBind>,
  ) {
    this.mode = (env.OPS_INTEGRATION_MODE as IntegrationMode) || 'standalone';
    const stub = new NotImplementedAdapter();
    if (this.mode === 'connected') {
      // connected 模式：全部走管理系统真实适配器（服务账号凭证，方案 §5.4）
      const client = new MsApiClient();
      this.adapters = {
        product: new ConnectedProductAdapter(client),
        order: new ConnectedOrderAdapter(client),
        commission: new ConnectedCommissionAdapter(client),
        auth: new ConnectedAuthAdapter(),
      };
    } else {
      this.adapters = { product: stub, order: stub, commission: stub, auth: stub };
    }
  }

  isStandalone(): boolean {
    return this.mode === 'standalone';
  }

  /**
   * 主数据同步配置视图（P3 客户自决）。
   * canSync：仅当「同时使用两个系统」的三项条件全部满足才为 true。
   */
  async getSyncConfig(tenantId: string): Promise<SyncConfigView> {
    const cfg = await this.getOrCreateCfg(tenantId);
    const conditions = await this.checkSyncConditions(tenantId);
    return {
      mode: this.mode,
      syncEnabled: cfg.syncEnabled === 1,
      scopes: {
        products: cfg.syncProducts === 1,
        customers: cfg.syncCustomers === 1,
        inventory: cfg.syncInventory === 1,
        orders: cfg.syncOrders === 1,
      },
      canSync: conditions.connected && conditions.serviceAccount && conditions.tenantBind,
      conditions,
    };
  }

  /**
   * 更新同步开关（客户自决）。
   * 开启同步必须满足「同时使用两个系统」条件：
   * 1) connected 模式（已对接管理系统）
   * 2) 服务账号已配置（管理系统侧同步有对应配置）
   * 3) 租户映射存在（ops_tenant_bind）
   */
  async updateSyncConfig(
    tenantId: string,
    dto: {
      syncEnabled: boolean;
      scopes?: Partial<Record<'products' | 'customers' | 'inventory' | 'orders', boolean>>;
    },
  ): Promise<SyncConfigView> {
    const conditions = await this.checkSyncConditions(tenantId);
    if (dto.syncEnabled) {
      if (!conditions.connected) throw new AppError('SYNC_REQUIRES_CONNECTED');
      if (!conditions.serviceAccount) throw new AppError('SYNC_REQUIRES_SERVICE_ACCOUNT');
      if (!conditions.tenantBind) throw new AppError('SYNC_REQUIRES_TENANT_BIND');
    }

    const cfg = await this.getOrCreateCfg(tenantId);
    cfg.syncEnabled = dto.syncEnabled ? 1 : 0;
    if (dto.scopes) {
      const scopes = dto.scopes;
      if (scopes.products !== undefined) cfg.syncProducts = scopes.products ? 1 : 0;
      if (scopes.customers !== undefined) cfg.syncCustomers = scopes.customers ? 1 : 0;
      if (scopes.inventory !== undefined) cfg.syncInventory = scopes.inventory ? 1 : 0;
      if (scopes.orders !== undefined) cfg.syncOrders = scopes.orders ? 1 : 0;
    }
    await this.cfgRepo!.save(cfg);
    return this.getSyncConfig(tenantId);
  }

  /** 读取或创建当前租户的接入配置（每租户一条） */
  private async getOrCreateCfg(tenantId: string): Promise<IntegrationCfg> {
    if (!this.cfgRepo) throw new AppError('INTERNAL_ERROR');
    let cfg = await this.cfgRepo.findOne({ where: { tenantId } });
    if (!cfg) {
      cfg = this.cfgRepo.create({
        tenantId,
        integrationMode: this.mode,
        syncEnabled: 0,
        syncProducts: 0,
        syncCustomers: 0,
        syncInventory: 0,
        syncOrders: 0,
      });
      cfg = await this.cfgRepo.save(cfg);
    }
    return cfg;
  }

  /** 「同时使用两个系统」条件判定 */
  private async checkSyncConditions(tenantId: string): Promise<SyncConditions> {
    const connected = this.mode === 'connected';
    const serviceAccount = !!(env.OPS_MS_CLIENT_ID && env.OPS_MS_CLIENT_SECRET);
    let tenantBind = false;
    if (this.tenantBindRepo) {
      const bind = await this.tenantBindRepo.findOne({
        where: { opsTenantId: tenantId, status: 1 },
      });
      tenantBind = !!bind;
    }
    return { connected, serviceAccount, tenantBind };
  }
}

export interface SyncScopes {
  products: boolean;
  customers: boolean;
  inventory: boolean;
  orders: boolean;
}

export interface SyncConditions {
  connected: boolean;
  serviceAccount: boolean;
  tenantBind: boolean;
}

export interface SyncConfigView {
  mode: IntegrationMode;
  syncEnabled: boolean;
  scopes: SyncScopes;
  canSync: boolean;
  conditions: SyncConditions;
}
