import { TalentCommerceController } from './v.controller';

describe('TalentCommerceController', () => {
  let controller: TalentCommerceController;
  let svc: { [k: string]: jest.Mock };

  beforeEach(() => {
    svc = {
      createTalent: jest.fn(),
      listTalents: jest.fn(),
      getTalent: jest.fn(),
      updateTalent: jest.fn(),
      setTalentStatus: jest.fn(),
      deleteTalent: jest.fn(),
      createBrandOrder: jest.fn(),
      listBrandOrders: jest.fn(),
      getBrandOrder: jest.fn(),
      setBrandOrderStatus: jest.fn(),
      settleBrandOrder: jest.fn(),
      deleteBrandOrder: jest.fn(),
      summary: jest.fn(),
    };
    controller = new TalentCommerceController(svc as any);
  });

  it('createTalent 委托 service 并返回信封', async () => {
    const dto = { name: 't' };
    svc.createTalent.mockResolvedValue({ id: 1 });
    const r = await controller.createTalent(dto);
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ id: 1 });
    expect(svc.createTalent).toHaveBeenCalledWith(dto);
  });

  it('listTalents 委托 service 并返回信封', async () => {
    svc.listTalents.mockResolvedValue([{ id: 1 }]);
    const r = await controller.listTalents();
    expect(r.code).toBe('0');
    expect(r.data).toEqual([{ id: 1 }]);
    expect(svc.listTalents).toHaveBeenCalledTimes(1);
  });

  it('getTalent 委托 service 并返回信封', async () => {
    svc.getTalent.mockResolvedValue({ id: 2 });
    const r = await controller.getTalent(2);
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ id: 2 });
    expect(svc.getTalent).toHaveBeenCalledWith(2);
  });

  it('updateTalent 委托 service 并返回信封', async () => {
    const dto = { name: 't2' };
    svc.updateTalent.mockResolvedValue({ id: 2, name: 't2' });
    const r = await controller.updateTalent(2, dto);
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ id: 2, name: 't2' });
    expect(svc.updateTalent).toHaveBeenCalledWith(2, dto);
  });

  it('setTalentStatus 委托 service 并返回信封', async () => {
    svc.setTalentStatus.mockResolvedValue({ id: 2, status: 'active' });
    const r = await controller.setTalentStatus(2, 'active');
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ id: 2, status: 'active' });
    expect(svc.setTalentStatus).toHaveBeenCalledWith(2, 'active');
  });

  it('deleteTalent 委托 service 并返回信封', async () => {
    svc.deleteTalent.mockResolvedValue({ deleted: true });
    const r = await controller.deleteTalent(2);
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ deleted: true });
    expect(svc.deleteTalent).toHaveBeenCalledWith(2);
  });

  it('createBrandOrder 委托 service 并返回信封', async () => {
    const dto = { talentId: 1 };
    svc.createBrandOrder.mockResolvedValue({ id: 5 });
    const r = await controller.createBrandOrder(dto as any);
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ id: 5 });
    expect(svc.createBrandOrder).toHaveBeenCalledWith(dto);
  });

  it('listBrandOrders 委托 service 并返回信封', async () => {
    svc.listBrandOrders.mockResolvedValue([{ id: 5 }]);
    const r = await controller.listBrandOrders();
    expect(r.code).toBe('0');
    expect(r.data).toEqual([{ id: 5 }]);
    expect(svc.listBrandOrders).toHaveBeenCalledTimes(1);
  });

  it('getBrandOrder 委托 service 并返回信封', async () => {
    svc.getBrandOrder.mockResolvedValue({ id: 6 });
    const r = await controller.getBrandOrder(6);
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ id: 6 });
    expect(svc.getBrandOrder).toHaveBeenCalledWith(6);
  });

  it('setBrandOrderStatus 委托 service 并返回信封', async () => {
    svc.setBrandOrderStatus.mockResolvedValue({ id: 6, status: 'settled' });
    const r = await controller.setBrandOrderStatus(6, 'settled');
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ id: 6, status: 'settled' });
    expect(svc.setBrandOrderStatus).toHaveBeenCalledWith(6, 'settled');
  });

  it('settleBrandOrder 委托 service 并返回信封', async () => {
    const dto = { amount: 100 };
    svc.settleBrandOrder.mockResolvedValue({ id: 6, settled: true });
    const r = await controller.settleBrandOrder(6, dto as any);
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ id: 6, settled: true });
    expect(svc.settleBrandOrder).toHaveBeenCalledWith(6, dto);
  });

  it('deleteBrandOrder 委托 service 并返回信封', async () => {
    svc.deleteBrandOrder.mockResolvedValue({ deleted: true });
    const r = await controller.deleteBrandOrder(6);
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ deleted: true });
    expect(svc.deleteBrandOrder).toHaveBeenCalledWith(6);
  });

  it('summary 委托 service 并返回信封', async () => {
    svc.summary.mockResolvedValue({ talents: 3, orders: 2 });
    const r = await controller.summary();
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ talents: 3, orders: 2 });
    expect(svc.summary).toHaveBeenCalledTimes(1);
  });
});
