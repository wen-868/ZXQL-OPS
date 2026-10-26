import { RevenueController } from './w.controller';

describe('RevenueController', () => {
  let controller: RevenueController;
  let revenueService: { [k: string]: jest.Mock };

  beforeEach(() => {
    revenueService = {
      recordRevenue: jest.fn(),
      listRevenue: jest.fn(),
      reconcile: jest.fn(),
      getReconciliation: jest.fn(),
      settle: jest.fn(),
      invoice: jest.fn(),
      profit: jest.fn(),
    };
    controller = new RevenueController(revenueService as any);
  });

  it('recordRevenue 委托 service 并返回信封', async () => {
    const dto = { amount: 10, source: 'order' };
    revenueService.recordRevenue.mockResolvedValue({ id: 1 });
    const r = await controller.recordRevenue(dto as any);
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ id: 1 });
    expect(revenueService.recordRevenue).toHaveBeenCalledWith(dto);
  });

  it('listRevenue 委托 service 并返回信封', async () => {
    revenueService.listRevenue.mockResolvedValue([{ id: 1 }]);
    const r = await controller.listRevenue('order');
    expect(r.code).toBe('0');
    expect(r.data).toEqual([{ id: 1 }]);
    expect(revenueService.listRevenue).toHaveBeenCalledWith('order');
  });

  it('reconcile 委托 service 并返回信封', async () => {
    const dto = { period: '2026-08' };
    revenueService.reconcile.mockResolvedValue({ matched: 3 });
    const r = await controller.reconcile(dto);
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ matched: 3 });
    expect(revenueService.reconcile).toHaveBeenCalledWith(dto);
  });

  it('getReconciliation 委托 service 并返回信封', async () => {
    revenueService.getReconciliation.mockResolvedValue({ id: 2 });
    const r = await controller.getReconciliation('2');
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ id: 2 });
    expect(revenueService.getReconciliation).toHaveBeenCalledWith(2);
  });

  it('settle 委托 service 并返回信封', async () => {
    const dto = { period: '2026-08' };
    revenueService.settle.mockResolvedValue({ settled: true });
    const r = await controller.settle(dto as any);
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ settled: true });
    expect(revenueService.settle).toHaveBeenCalledWith(dto);
  });

  it('invoice 委托 service 并返回信封', async () => {
    revenueService.invoice.mockResolvedValue({ invoiceNo: 'INV-1' });
    const r = await controller.invoice('2');
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ invoiceNo: 'INV-1' });
    expect(revenueService.invoice).toHaveBeenCalledWith(2);
  });

  it('profit 委托 service 并返回信封', async () => {
    revenueService.profit.mockResolvedValue({ total: 100 });
    const r = await controller.profit();
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ total: 100 });
    expect(revenueService.profit).toHaveBeenCalledTimes(1);
  });
});
