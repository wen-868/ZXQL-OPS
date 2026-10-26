import { BrowserService } from './browser.service';

/**
 * AI 页面观察服务测试。
 * 覆盖：未就绪态报错、URL 拼装（路径白名单式处理）、演示登录兜底、销毁清理。
 * 不启动真实 Chromium（start 内部失败即走 reject 分支）。
 */
describe('BrowserService', () => {
  let svc: BrowserService;
  let page: { [k: string]: jest.Mock };

  beforeEach(() => {
    svc = new BrowserService();
    page = {
      goto: jest.fn().mockResolvedValue(undefined),
      url: jest.fn().mockReturnValue('http://localhost:5173/home'),
      title: jest.fn().mockResolvedValue('首页'),
      evaluate: jest.fn().mockResolvedValue({ headings: [] }),
      screenshot: jest.fn().mockResolvedValue(Buffer.from('png')),
      waitForTimeout: jest.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(async () => {
    await svc.onModuleDestroy();
  });

  it('state() 初始为未就绪', () => {
    const s = svc.state();
    expect(s.ready).toBe(false);
    expect(typeof s.base).toBe('string');
    expect(s.url).toBeNull();
  });

  describe('targetUrl 拼装（经 navigate/snapshot 间接验证）', () => {
    it('非 / 开头的 path 回落 /home', async () => {
      // 强制注入已就绪的 page，跳过真实 Chromium 启动
      (svc as unknown as { page: unknown; ready: boolean }).page = page;
      (svc as unknown as { page: unknown; ready: boolean }).ready = true;

      await svc.navigate({ path: 'evil-path' });
      expect(page.goto).toHaveBeenCalledWith(expect.stringContaining('/home'), expect.any(Object));
    });

    it('合法路径与查询串原样拼接', async () => {
      (svc as unknown as { page: unknown; ready: boolean }).page = page;
      (svc as unknown as { page: unknown; ready: boolean }).ready = true;

      await svc.navigate({ path: '/publish', query: 'days=30' });
      expect(page.goto).toHaveBeenCalledWith(
        expect.stringContaining('/publish?days=30'),
        expect.any(Object),
      );
    });
  });

  describe('未就绪时的行为', () => {
    // start() 会真实拉起 Chromium（依赖本机环境且慢），这里 stub 掉，
    // 只验证「浏览器未就绪」守卫分支本身。
    beforeEach(() => {
      (svc as unknown as { start: () => Promise<void> }).start = jest
        .fn()
        .mockResolvedValue(undefined);
    });

    it('page 未就绪时 navigate 抛错', async () => {
      await expect(svc.navigate({ path: '/home' })).rejects.toThrow('浏览器未就绪');
    });

    it('page 未就绪时 snapshot 抛错', async () => {
      await expect(svc.snapshot({ path: '/home' })).rejects.toThrow('浏览器未就绪');
    });
  });

  describe('snapshot', () => {
    it('就绪时返回截图与摘要', async () => {
      (svc as unknown as { page: unknown; ready: boolean }).page = page;
      (svc as unknown as { page: unknown; ready: boolean }).ready = true;

      const r = await svc.snapshot({ path: '/home' });
      expect(r.screenshot).toMatch(/^data:image\/png;base64,/);
      expect(r.url).toBe('http://localhost:5173/home');
      expect(r.title).toBe('首页');
      expect(r.summary).toBeDefined();
    });
  });

  describe('onModuleDestroy', () => {
    it('销毁后状态复位', async () => {
      (svc as unknown as { page: unknown; ready: boolean }).page = page;
      (svc as unknown as { page: unknown; ready: boolean }).ready = true;

      await svc.onModuleDestroy();
      const s = svc.state();
      expect(s.ready).toBe(false);
      expect(s.url).toBeNull();
    });
  });
});
