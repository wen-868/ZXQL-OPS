import { ConnectedProductAdapter } from './connected-product.adapter';
import { ConnectedOrderAdapter } from './connected-order.adapter';
import { ConnectedCommissionAdapter } from './connected-commission.adapter';
import { AppError } from '../shared/app-error';

/**
 * connected 适配器单测：验证调用路径/参数与响应映射（管理系统契约对齐）。
 */

function mockClient() {
  return {
    request: jest.fn(),
  };
}

describe('ConnectedProductAdapter（商品）', () => {
  it('listProducts：按分页参数调用管理系统并映射 ProductDTO', async () => {
    const client = mockClient();
    client.request.mockResolvedValue({
      list: [
        { id: 10, name: '飞天茅台', retailPrice: 1499, mainImage: 'http://x/1.png' },
        { id: 11, name: '五粮液', retailPrice: 899, mainImage: null },
      ],
    });
    const adapter = new ConnectedProductAdapter(client as never);
    const list = await adapter.listProducts({ tenantId: 't_dev', page: 2, pageSize: 10 });

    expect(client.request).toHaveBeenCalledWith('GET', '/admin/products', {
      tenantId: 't_dev',
      query: { page: 2, pageSize: 10, keyword: undefined },
    });
    expect(list).toEqual([
      { id: '10', title: '飞天茅台', price: 1499, imageUrl: 'http://x/1.png' },
      { id: '11', title: '五粮液', price: 899, imageUrl: undefined },
    ]);
  });

  it('getProduct：映射单商品详情', async () => {
    const client = mockClient();
    client.request.mockResolvedValue({ id: 5, name: '茅台1935', wholesalePrice: 1188 });
    const adapter = new ConnectedProductAdapter(client as never);
    const p = await adapter.getProduct('5');
    expect(p).toEqual({ id: '5', title: '茅台1935', price: 1188, imageUrl: undefined });
  });

  it('bindCart：connected 模式无挂车概念 → NOT_IMPLEMENTED', async () => {
    const adapter = new ConnectedProductAdapter(mockClient() as never);
    try {
      await adapter.bindCart('1', '2');
      throw new Error('expected to throw');
    } catch (err) {
      expect((err as { code?: string }).code).toBe('NOT_IMPLEMENTED');
    }
  });
});

describe('ConnectedOrderAdapter（订单/库存）', () => {
  it('listOrders / queryStock / pushOrder 走管理系统契约路径', async () => {
    const client = mockClient();
    client.request
      .mockResolvedValueOnce({ list: [{ orderNo: 'SO-1' }] })
      .mockResolvedValueOnce({ list: [{ skuId: 1, availableQty: 50 }] })
      .mockResolvedValueOnce({ orderId: 'OPS-1', accepted: true });
    const adapter = new ConnectedOrderAdapter(client as never);

    const orders = await adapter.listOrders('t_dev', { status: 'paid' });
    expect(orders).toEqual([{ orderNo: 'SO-1' }]);
    expect(client.request).toHaveBeenCalledWith('GET', '/admin/orders', {
      tenantId: 't_dev',
      query: {
        page: undefined,
        pageSize: undefined,
        keyword: undefined,
        status: 'paid',
        dateStart: undefined,
        dateEnd: undefined,
      },
    });

    const stock = await adapter.queryStock('t_dev', 'SKU-1');
    expect(stock).toEqual([{ skuId: 1, availableQty: 50 }]);
    expect(client.request).toHaveBeenCalledWith('GET', '/admin/inventory-balance', {
      tenantId: 't_dev',
      query: { page: 1, pageSize: 20, keyword: 'SKU-1' },
    });

    const pushed = await adapter.pushOrder('t_dev', { orderId: 'OPS-1' });
    expect(pushed).toEqual({ orderId: 'OPS-1', accepted: true });
    expect(client.request).toHaveBeenCalledWith('POST', '/admin/orders', {
      tenantId: 't_dev',
      body: { orderId: 'OPS-1' },
    });
  });
});

describe('ConnectedCommissionAdapter（佣金/财务）', () => {
  it('getCommissionSummary / queryFinancial / settleCommission 走管理系统契约路径', async () => {
    const client = mockClient();
    client.request
      .mockResolvedValueOnce({ list: [{ id: 1 }] })
      .mockResolvedValueOnce({ revenue: 100 })
      .mockResolvedValueOnce({ status: 'settled' });
    const adapter = new ConnectedCommissionAdapter(client as never);

    const summary = await adapter.getCommissionSummary('t_dev');
    expect(summary).toEqual([{ id: 1 }]);
    expect(client.request).toHaveBeenCalledWith('GET', '/admin/commission/records', {
      tenantId: 't_dev',
      query: { page: 1, pageSize: 20 },
    });

    const fin = await adapter.queryFinancial('t_dev', { begin: '2026-08-01' });
    expect(fin).toEqual({ revenue: 100 });
    expect(client.request).toHaveBeenCalledWith('GET', '/admin/finance/dashboard', {
      tenantId: 't_dev',
      query: { begin: '2026-08-01', end: undefined },
    });

    const settled = await adapter.settleCommission('t_dev', { type: 'settle' });
    expect(settled).toEqual({ status: 'settled' });
    expect(client.request).toHaveBeenCalledWith('POST', '/admin/commission/settle', {
      tenantId: 't_dev',
      body: { type: 'settle' },
    });
  });
});

describe('ConnectedProductAdapter（错误类型）', () => {
  it('依赖 AppError 错误码表（回归保护）', () => {
    expect(AppError).toBeDefined();
  });
});
