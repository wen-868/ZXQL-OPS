import { SystemConfigController } from './system-config.controller';

describe('SystemConfigController', () => {
  let controller: SystemConfigController;
  let svc: { [k: string]: jest.Mock };

  beforeEach(() => {
    svc = { list: jest.fn(), get: jest.fn(), getMasked: jest.fn(), set: jest.fn() };
    controller = new SystemConfigController(svc as any);
  });

  it('list 委托 svc.list 并返回 { list } 信封', async () => {
    svc.list.mockResolvedValue([{ key: 'k', value: 'v' }]);
    const r = await controller.list();
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ list: [{ key: 'k', value: 'v' }] });
    expect(svc.list).toHaveBeenCalledTimes(1);
  });

  it('get 走 getMasked（敏感值不回明文）并返回 { key, value } 信封', async () => {
    svc.getMasked.mockResolvedValue('******');
    const r = await controller.get('oauth.douyin.appSecret');
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ key: 'oauth.douyin.appSecret', value: '******' });
    expect(svc.getMasked).toHaveBeenCalledWith('oauth.douyin.appSecret');
    expect(svc.get).not.toHaveBeenCalled();
  });

  it('update 委托 svc.set(key, dto.value) 并返回信封', async () => {
    svc.set.mockResolvedValue({ key: 'k', value: 'new' });
    const r = await controller.update('k', { value: 'new' });
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ key: 'k', value: 'new' });
    expect(svc.set).toHaveBeenCalledWith('k', 'new');
  });
});
