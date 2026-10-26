import { PrivateController } from './private.controller';

describe('PrivateController', () => {
  let controller: PrivateController;
  let privateService: { [k: string]: jest.Mock };

  beforeEach(() => {
    privateService = {
      upsertFans: jest.fn(),
      listFans: jest.fn(),
      tagFans: jest.fn(),
      createGroup: jest.fn(),
      pushGroup: jest.fn(),
      distribute: jest.fn(),
      repurchase: jest.fn(),
    };
    controller = new PrivateController(privateService as any);
  });

  it('upsertFans 委托 service 并返回信封', async () => {
    const dto = { platform: 'douyin', fansId: 'x' };
    privateService.upsertFans.mockResolvedValue({ id: 1 });
    const r = await controller.upsertFans(dto as any);
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ id: 1 });
    expect(privateService.upsertFans).toHaveBeenCalledWith(dto);
  });

  it('listFans 委托 service 并返回信封', async () => {
    privateService.listFans.mockResolvedValue([{ id: 1 }]);
    const r = await controller.listFans('douyin');
    expect(r.code).toBe('0');
    expect(r.data).toEqual([{ id: 1 }]);
    expect(privateService.listFans).toHaveBeenCalledWith('douyin');
  });

  it('tagFans 委托 service 并返回信封', async () => {
    const dto = { fansIds: [1], tags: ['vip'] };
    privateService.tagFans.mockResolvedValue({ tagged: 1 });
    const r = await controller.tagFans(dto as any);
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ tagged: 1 });
    expect(privateService.tagFans).toHaveBeenCalledWith(dto);
  });

  it('createGroup 委托 service 并返回信封', async () => {
    const dto = { name: 'g' };
    privateService.createGroup.mockResolvedValue({ id: 2 });
    const r = await controller.createGroup(dto);
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ id: 2 });
    expect(privateService.createGroup).toHaveBeenCalledWith(dto);
  });

  it('pushGroup 委托 service 并返回信封', async () => {
    privateService.pushGroup.mockResolvedValue({ pushed: 5 });
    const r = await controller.pushGroup('2');
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ pushed: 5 });
    expect(privateService.pushGroup).toHaveBeenCalledWith(2);
  });

  it('distribute 委托 service 并返回信封', async () => {
    const dto = { fansIds: [1] };
    privateService.distribute.mockResolvedValue({ done: true });
    const r = await controller.distribute(dto as any);
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ done: true });
    expect(privateService.distribute).toHaveBeenCalledWith(dto);
  });

  it('repurchase 委托 service 并返回信封', async () => {
    const dto = { fansIds: [1] };
    privateService.repurchase.mockResolvedValue({ done: true });
    const r = await controller.repurchase(dto as any);
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ done: true });
    expect(privateService.repurchase).toHaveBeenCalledWith(dto);
  });
});
