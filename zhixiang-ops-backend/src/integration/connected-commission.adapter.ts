import { MsApiClient } from './ms-client';
import { CommissionAdapter } from './adapters';

/**
 * 管理系统佣金/财务适配器（connected 模式，方案 §18-⑤）。
 * - getCommissionSummary：佣金记录列表
 * - queryFinancial：财务驾驶舱（真源展示）
 * - settleCommission：分账结果回写（POST /admin/commission/settle）
 */
export class ConnectedCommissionAdapter implements CommissionAdapter {
  constructor(private readonly client: MsApiClient) {}

  async getCommissionSummary(tenantId: string): Promise<unknown> {
    const data = await this.client.request<{ list?: unknown[] }>(
      'GET',
      '/admin/commission/records',
      { tenantId, query: { page: 1, pageSize: 20 } },
    );
    return data.list ?? [];
  }

  async queryFinancial(tenantId: string, params: Record<string, unknown>): Promise<unknown> {
    return this.client.request('GET', '/admin/finance/dashboard', {
      tenantId,
      query: { begin: params.begin, end: params.end },
    });
  }

  async settleCommission(tenantId: string, settlement: Record<string, unknown>): Promise<unknown> {
    return this.client.request('POST', '/admin/commission/settle', {
      tenantId,
      body: settlement,
    });
  }
}
