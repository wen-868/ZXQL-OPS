import { MsApiClient } from './ms-client';
import { OrderAdapter } from './adapters';

/**
 * 管理系统订单/库存适配器（connected 模式，方案 §18-④）。
 * - listOrders/getOrder：读管理系统订单（真源）
 * - queryStock：读管理系统库存余额
 * - pushOrder：挂车转化推单回管理系统（管理系统侧 POST /api/admin/orders 受理）
 */
export class ConnectedOrderAdapter implements OrderAdapter {
  constructor(private readonly client: MsApiClient) {}

  async listOrders(tenantId: string, params: Record<string, unknown>): Promise<unknown[]> {
    const data = await this.client.request<{ list?: unknown[] }>('GET', '/admin/orders', {
      tenantId,
      query: {
        page: params.page,
        pageSize: params.pageSize,
        keyword: params.keyword,
        status: params.status,
        dateStart: params.dateStart,
        dateEnd: params.dateEnd,
      },
    });
    return data.list ?? [];
  }

  async getOrder(tenantId: string, orderId: string): Promise<unknown> {
    return this.client.request('GET', `/admin/orders/${encodeURIComponent(orderId)}`, {
      tenantId,
    });
  }

  async queryStock(tenantId: string, sku?: string): Promise<unknown> {
    const data = await this.client.request<{ list?: unknown[] }>(
      'GET',
      '/admin/inventory-balance',
      { tenantId, query: { page: 1, pageSize: 20, keyword: sku } },
    );
    return data.list ?? [];
  }

  async pushOrder(tenantId: string, order: Record<string, unknown>): Promise<unknown> {
    return this.client.request('POST', '/admin/orders', { tenantId, body: order });
  }
}
