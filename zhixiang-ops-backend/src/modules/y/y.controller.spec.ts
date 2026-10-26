import { OrderController } from './y.controller';

describe('OrderController', () => {
  let controller: OrderController;
  let orderService: { [k: string]: jest.Mock };

  beforeEach(() => {
    orderService = {
      syncOrders: jest.fn(),
      listOrders: jest.fn(),
      getOrder: jest.fn(),
      refund: jest.fn(),
      getLogisticsTrack: jest.fn(),
      createWaybill: jest.fn(),
      batchWaybill: jest.fn(),
      syncInventory: jest.fn(),
      inventoryWarn: jest.fn(),
    };
    controller = new OrderController(orderService as any);
  });

  it('syncOrders 委托 service 并返回信封', async () => {
    const dto = { platform: 'douyin', orders: [] };
    orderService.syncOrders.mockResolvedValue({ synced: 3 });
    const r = await controller.syncOrders(dto);
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ synced: 3 });
    expect(orderService.syncOrders).toHaveBeenCalledWith(dto);
  });

  it('listOrders 委托 service 并返回信封', async () => {
    const q = { status: 'pending', platform: 'douyin' };
    orderService.listOrders.mockResolvedValue([{ id: 1 }]);
    const r = await controller.listOrders(q);
    expect(r.code).toBe('0');
    expect(r.data).toEqual([{ id: 1 }]);
    expect(orderService.listOrders).toHaveBeenCalledWith({
      status: q.status,
      platform: q.platform,
    });
  });

  it('getOrder 委托 service 并返回信封', async () => {
    orderService.getOrder.mockResolvedValue({ id: 1 });
    const r = await controller.getOrder('1');
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ id: 1 });
    expect(orderService.getOrder).toHaveBeenCalledWith(1);
  });

  it('refund 委托 service 并返回信封', async () => {
    orderService.refund.mockResolvedValue({ refunded: true });
    const r = await controller.refund('1');
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ refunded: true });
    expect(orderService.refund).toHaveBeenCalledWith(1);
  });

  it('getTrack 委托 service 并返回信封', async () => {
    orderService.getLogisticsTrack.mockResolvedValue({ events: [] });
    const r = await controller.getTrack('1');
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ events: [] });
    expect(orderService.getLogisticsTrack).toHaveBeenCalledWith(1);
  });

  it('createWaybill 委托 service 并返回信封', async () => {
    const dto = { express: 'SF' };
    orderService.createWaybill.mockResolvedValue({ waybillNo: 'W1' });
    const r = await controller.createWaybill('1', dto as any);
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ waybillNo: 'W1' });
    expect(orderService.createWaybill).toHaveBeenCalledWith(1, dto);
  });

  it('batchWaybill 委托 service 并返回信封', async () => {
    const dto = { orderIds: [1, 2] };
    orderService.batchWaybill.mockResolvedValue({ count: 2 });
    const r = await controller.batchWaybill(dto);
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ count: 2 });
    expect(orderService.batchWaybill).toHaveBeenCalledWith(dto);
  });

  it('syncInventory 委托 service 并返回信封', async () => {
    const dto = { items: [] };
    orderService.syncInventory.mockResolvedValue({ synced: 1 });
    const r = await controller.syncInventory(dto as any);
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ synced: 1 });
    expect(orderService.syncInventory).toHaveBeenCalledWith(dto);
  });

  it('inventoryWarn 缺省 threshold 时默认 10 并返回信封', async () => {
    orderService.inventoryWarn.mockResolvedValue([{ sku: 'a', stock: 5 }]);
    const r = await controller.inventoryWarn();
    expect(r.code).toBe('0');
    expect(r.data).toEqual([{ sku: 'a', stock: 5 }]);
    expect(orderService.inventoryWarn).toHaveBeenCalledWith(10);
  });

  it('inventoryWarn 传入 threshold 时转为数字并返回信封', async () => {
    orderService.inventoryWarn.mockResolvedValue([]);
    const r = await controller.inventoryWarn('20');
    expect(r.code).toBe('0');
    expect(r.data).toEqual([]);
    expect(orderService.inventoryWarn).toHaveBeenCalledWith(20);
  });
});
