import { BadRequestException } from '@nestjs/common';
import { BrowserController } from './browser.controller';

describe('BrowserController', () => {
  let controller: BrowserController;
  let browserService: { [k: string]: jest.Mock };
  let browserGateway: { [k: string]: jest.Mock };
  const adapterStubs = [
    { name: 'douyin', login: jest.fn().mockResolvedValue({ success: true }) },
    { name: 'xiaohongshu', login: jest.fn().mockResolvedValue({ success: true }) },
    { name: 'video-number', login: jest.fn().mockResolvedValue({ success: true }) },
  ];
  const [douyin, xiaohongshu, videoNumber] = adapterStubs as any[];

  beforeEach(() => {
    browserService = {
      state: jest.fn(),
      navigate: jest.fn(),
      snapshot: jest.fn(),
    };
    browserGateway = {
      getBrowserPage: jest.fn().mockResolvedValue({
        page: { url: () => 'about:blank' },
        instanceId: 'instance-0',
      }),
      releaseBrowserPage: jest.fn(),
    };
    douyin.login.mockClear();
    xiaohongshu.login.mockClear();
    videoNumber.login.mockClear();
    controller = new BrowserController(
      browserService as any,
      browserGateway as any,
      douyin,
      xiaohongshu,
      videoNumber,
    );
  });

  it('state 透传 browserService.state()', async () => {
    browserService.state.mockReturnValue({ ready: true, base: 'http://localhost:5173' });
    const r = controller.state();
    expect(r).toEqual({ ready: true, base: 'http://localhost:5173' });
    expect(browserService.state).toHaveBeenCalledTimes(1);
  });

  it('navigate 透传 dto 并返回结果', async () => {
    browserService.navigate.mockResolvedValue({ url: 'http://localhost:5173/publish' });
    const r = await controller.navigate({ path: '/publish' });
    expect(r).toEqual({ url: 'http://localhost:5173/publish' });
    expect(browserService.navigate).toHaveBeenCalledWith({ path: '/publish' });
  });

  it('snapshot 透传 dto 并返回截图+摘要', async () => {
    browserService.snapshot.mockResolvedValue({
      url: '/home',
      screenshot: 'data:image/png;base64,x',
      summary: {},
    });
    const r = await controller.snapshot({ path: '/home' });
    expect(r).toHaveProperty('screenshot');
    expect(browserService.snapshot).toHaveBeenCalledWith({ path: '/home' });
  });

  it('adapters 返回三平台能力清单', () => {
    const list = controller.adapters() as any[];
    expect(list.map((a) => a.platform)).toEqual(['douyin', 'xiaohongshu', 'video-number']);
  });

  it('adapterLogin 路由到对应适配器并归还页面', async () => {
    const r = await controller.adapterLogin('douyin');
    expect(r).toEqual({ success: true });
    expect(douyin.login).toHaveBeenCalledTimes(1);
    expect(browserGateway.releaseBrowserPage).toHaveBeenCalledWith('instance-0', expect.anything());
  });

  it('adapterLogin 未知平台抛 400 且不占用池页面', async () => {
    await expect(controller.adapterLogin('kuaishou')).rejects.toThrow(BadRequestException);
    expect(browserGateway.getBrowserPage).not.toHaveBeenCalled();
  });

  it('adapterLogin 池耗尽返回失败结构', async () => {
    browserGateway.getBrowserPage.mockResolvedValue(null);
    const r = await controller.adapterLogin('xiaohongshu');
    expect(r).toEqual({
      success: false,
      error: 'No available browser instance (pool exhausted or circuit open)',
    });
  });

  it('adapterLogin 适配器异常仍归还页面', async () => {
    douyin.login.mockRejectedValueOnce(new Error('boom'));
    await expect(controller.adapterLogin('douyin')).rejects.toThrow('boom');
    expect(browserGateway.releaseBrowserPage).toHaveBeenCalledWith('instance-0', expect.anything());
  });
});
