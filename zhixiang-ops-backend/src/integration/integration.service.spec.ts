import { IntegrationService } from './integration.service';
import { AppError } from '../shared/app-error';
import { env } from '../config/env';
import { ConnectedProductAdapter } from './connected-product.adapter';
import { ConnectedOrderAdapter } from './connected-order.adapter';
import { ConnectedCommissionAdapter } from './connected-commission.adapter';
import { ConnectedAuthAdapter } from './connected-auth.adapter';

describe('IntegrationService', () => {
  it('默认 standalone 模式且适配器为 NotImplemented', () => {
    const svc = new IntegrationService();
    expect(svc.mode).toBe('standalone');
    expect(svc.isStandalone()).toBe(true);
    expect(() => svc.adapters.product.getProduct('1')).toThrow(AppError);
    expect(() => svc.adapters.product.listProducts({})).toThrow(AppError);
    expect(() => svc.adapters.order.queryStock('t1')).toThrow(AppError);
    expect(() => svc.adapters.order.pushOrder('t1', {})).toThrow(AppError);
    expect(() => svc.adapters.commission.queryFinancial('t1', {})).toThrow(AppError);
    expect(() => svc.adapters.commission.settleCommission('t1', {})).toThrow(AppError);
    expect(() => svc.adapters.auth.ssoLogin('t1')).toThrow(AppError);
    try {
      void svc.adapters.product.getProduct('1');
    } catch (e) {
      expect((e as AppError).code).toBe('NOT_IMPLEMENTED');
    }
  });

  it('connected 模式：认证/商品/订单/佣金全部装配真实适配器', () => {
    const original = env.OPS_INTEGRATION_MODE;
    env.OPS_INTEGRATION_MODE = 'connected';
    try {
      const svc = new IntegrationService();
      expect(svc.mode).toBe('connected');
      expect(svc.isStandalone()).toBe(false);
      expect(svc.adapters.product).toBeInstanceOf(ConnectedProductAdapter);
      expect(svc.adapters.order).toBeInstanceOf(ConnectedOrderAdapter);
      expect(svc.adapters.commission).toBeInstanceOf(ConnectedCommissionAdapter);
      expect(svc.adapters.auth).toBeInstanceOf(ConnectedAuthAdapter);
    } finally {
      env.OPS_INTEGRATION_MODE = original;
    }
  });

  describe('主数据同步开关（P3 客户自决）', () => {
    function buildSyncService(
      options: {
        mode?: 'standalone' | 'connected';
        serviceAccount?: boolean;
        tenantBind?: unknown;
        existingCfg?: unknown;
      } = {},
    ) {
      const originalMode = env.OPS_INTEGRATION_MODE;
      const originalId = env.OPS_MS_CLIENT_ID;
      const originalSecret = env.OPS_MS_CLIENT_SECRET;
      env.OPS_INTEGRATION_MODE = options.mode ?? 'standalone';
      env.OPS_MS_CLIENT_ID = options.serviceAccount ? 'test-id' : '';
      env.OPS_MS_CLIENT_SECRET = options.serviceAccount ? 'test-secret' : '';

      let currentCfg: unknown = options.existingCfg ?? null;
      const cfgRepo = {
        findOne: jest.fn(async () => currentCfg),
        create: jest.fn((dto) => ({ id: 1, ...dto })),
        save: jest.fn(async (cfg) => {
          currentCfg = cfg;
          return cfg;
        }),
      };
      const tenantBindRepo = {
        findOne: jest.fn(async () => options.tenantBind ?? null),
      };
      const svc = new IntegrationService(cfgRepo as never, tenantBindRepo as never);
      return {
        svc,
        restore: () => {
          env.OPS_INTEGRATION_MODE = originalMode;
          env.OPS_MS_CLIENT_ID = originalId;
          env.OPS_MS_CLIENT_SECRET = originalSecret;
        },
      };
    }

    it('standalone（独立模式）：canSync=false，开启同步被拒', async () => {
      const { svc, restore } = buildSyncService({ mode: 'standalone' });
      try {
        const cfg = await svc.getSyncConfig('t_dev');
        expect(cfg.canSync).toBe(false);
        expect(cfg.conditions).toEqual({
          connected: false,
          serviceAccount: false,
          tenantBind: false,
        });
        await expect(svc.updateSyncConfig('t_dev', { syncEnabled: true })).rejects.toMatchObject({
          code: 'SYNC_REQUIRES_CONNECTED',
        });
      } finally {
        restore();
      }
    });

    it('connected 但服务账号未配置：被拒（SYNC_REQUIRES_SERVICE_ACCOUNT）', async () => {
      const { svc, restore } = buildSyncService({
        mode: 'connected',
        serviceAccount: false,
        tenantBind: { id: 1 },
      });
      try {
        await expect(svc.updateSyncConfig('t_dev', { syncEnabled: true })).rejects.toMatchObject({
          code: 'SYNC_REQUIRES_SERVICE_ACCOUNT',
        });
      } finally {
        restore();
      }
    });

    it('connected + 服务账号但租户未映射：被拒（SYNC_REQUIRES_TENANT_BIND）', async () => {
      const { svc, restore } = buildSyncService({
        mode: 'connected',
        serviceAccount: true,
        tenantBind: null,
      });
      try {
        await expect(svc.updateSyncConfig('t_dev', { syncEnabled: true })).rejects.toMatchObject({
          code: 'SYNC_REQUIRES_TENANT_BIND',
        });
      } finally {
        restore();
      }
    });

    it('connected + 服务账号 + 租户映射：开启成功并保存细粒度开关', async () => {
      const { svc, restore } = buildSyncService({
        mode: 'connected',
        serviceAccount: true,
        tenantBind: { id: 1, opsTenantId: 't_dev', status: 1 },
      });
      try {
        const cfg = await svc.updateSyncConfig('t_dev', {
          syncEnabled: true,
          scopes: { products: true, inventory: true },
        });
        expect(cfg.syncEnabled).toBe(true);
        expect(cfg.scopes).toEqual({
          products: true,
          customers: false,
          inventory: true,
          orders: false,
        });
        expect(cfg.canSync).toBe(true);
      } finally {
        restore();
      }
    });

    it('关闭同步不要求条件（客户随时可关）', async () => {
      const { svc, restore } = buildSyncService({ mode: 'standalone' });
      try {
        const cfg = await svc.updateSyncConfig('t_dev', { syncEnabled: false });
        expect(cfg.syncEnabled).toBe(false);
      } finally {
        restore();
      }
    });
  });
});
