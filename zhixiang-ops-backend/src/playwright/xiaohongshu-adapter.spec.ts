import { XiaohongshuAdapter } from './xiaohongshu-adapter';
import { TenantContext } from '../tenant/tenant-context';

/**
 * 小红书适配器测试（mock Page 驱动）。
 * 覆盖：登录态/二维码/验证码拦截/重试耗尽/异常、发布回执判定。
 */
const mkPage = () => ({
  goto: jest.fn().mockResolvedValue(undefined),
  evaluate: jest.fn().mockResolvedValue(true),
  $: jest.fn().mockResolvedValue(null),
  waitForTimeout: jest.fn().mockResolvedValue(undefined),
  screenshot: jest.fn().mockResolvedValue(Buffer.from('png')),
});

describe('XiaohongshuAdapter', () => {
  let adapter: XiaohongshuAdapter;
  let audit: { record: jest.Mock };
  let page: ReturnType<typeof mkPage>;

  const run = <T>(fn: () => Promise<T>): Promise<T> =>
    TenantContext.run({ traceId: 't', tenantId: 'tn-1' }, fn);

  beforeEach(() => {
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    adapter = new XiaohongshuAdapter(audit as never);
    page = mkPage();
  });

  it('init：写审计', async () => {
    await run(() => adapter.init());
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'xiaohongshu_adapter_init' }),
    );
  });

  it('login：已登录直接成功', async () => {
    page.evaluate.mockResolvedValue(true);
    const r = await run(() => adapter.login(page as never));
    expect(r.success).toBe(true);
  });

  it('login：二维码存在 → 返回二维码', async () => {
    page.evaluate.mockResolvedValue(false);
    page.$.mockResolvedValueOnce({ screenshot: page.screenshot }).mockResolvedValue(null);
    const r = await run(() => adapter.login(page as never));
    expect(r.success).toBe(true);
    expect(r.qrCode).toBeDefined();
  });

  it('login：检测到验证码输入框 → 明确报错交人工', async () => {
    page.evaluate.mockResolvedValue(false);
    page.$.mockResolvedValueOnce(null).mockResolvedValue({ id: 1 });
    const r = await run(() => adapter.login(page as never));
    expect(r.success).toBe(false);
    expect(r.error).toContain('验证码');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'xiaohongshu_login_captcha_detected' }),
    );
  });

  it('login：重试耗尽视为已处理', async () => {
    page.evaluate.mockResolvedValue(false);
    page.$.mockResolvedValue(null);
    const r = await run(() => adapter.login(page as never));
    expect(r.success).toBe(true);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'xiaohongshu_login_no_option_after_retries' }),
    );
  });

  it('login：持续异常返回失败', async () => {
    page.goto.mockRejectedValue(new Error('net down'));
    const r = await run(() => adapter.login(page as never));
    expect(r.success).toBe(false);
    expect(r.error).toBeDefined();
  }, 30000);
});
