import { DouyinAdapter } from './douyin-adapter';
import { TenantContext } from '../tenant/tenant-context';

/**
 * 抖音创作者后台适配器测试（mock Page 驱动，不启动真实浏览器）。
 * 覆盖：登录态检测、二维码分支、重试耗尽、异常恢复、发布/上传流程编排。
 * 所有调用包在租户上下文中（init/审计依赖 requireTenantId）。
 */
const mkPage = () => ({
  goto: jest.fn().mockResolvedValue(undefined),
  evaluate: jest.fn().mockResolvedValue(true),
  $: jest.fn().mockResolvedValue(null),
  waitForTimeout: jest.fn().mockResolvedValue(undefined),
  screenshot: jest.fn().mockResolvedValue(Buffer.from('png')),
});

describe('DouyinAdapter', () => {
  let adapter: DouyinAdapter;
  let audit: { record: jest.Mock };
  let page: ReturnType<typeof mkPage>;

  /** 在租户上下文中执行异步操作（审计记录依赖 requireTenantId） */
  const run = <T>(fn: () => Promise<T>): Promise<T> =>
    TenantContext.run({ traceId: 't', tenantId: 'tn-1' }, fn);

  beforeEach(() => {
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    adapter = new DouyinAdapter(audit as never);
    page = mkPage();
  });

  it('init：执行器初始化并写审计', async () => {
    await run(() => adapter.init());
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'douyin_adapter_init' }),
    );
  });

  it('login：已登录直接成功', async () => {
    page.evaluate.mockResolvedValue(true);
    const r = await run(() => adapter.login(page as never));
    expect(r.success).toBe(true);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'douyin_login_already' }),
    );
  });

  it('login：未登录且存在二维码 → 返回二维码', async () => {
    page.evaluate.mockResolvedValue(false);
    page.$.mockResolvedValue({ screenshot: page.screenshot });
    const r = await run(() => adapter.login(page as never));
    expect(r.success).toBe(true);
    expect(r.qrCode).toBe(Buffer.from('png').toString('base64'));
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'douyin_login_qr_generated' }),
    );
  });

  it('login：未登录且无二维码 → 重试耗尽后视为已处理', async () => {
    page.evaluate.mockResolvedValue(false);
    page.$.mockResolvedValue(null);
    const r = await run(() => adapter.login(page as never));
    expect(r.success).toBe(true);
    expect(page.waitForTimeout).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'douyin_login_no_qr_after_retries' }),
    );
  });

  it('login：持续异常 → 记录错误并返回失败', async () => {
    page.goto.mockRejectedValue(new Error('net down'));
    const r = await run(() => adapter.login(page as never));
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'douyin_login_error' }),
    );
    expect(r.success).toBe(false);
    expect(r.error).toBeDefined();
    // 注：错误路径含真实重试退避（1s+2s+3s+4s），故放宽用例超时
  }, 30000);

  it('navigateToPublish：找到发布按钮成功', async () => {
    page.$.mockResolvedValue({ id: 1 });
    const r = await run(() => adapter.navigateToPublish(page as never));
    expect(r.success).toBe(true);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'douyin_navigate_to_publish' }),
    );
  });

  it('navigateToPublish：持续找不到按钮 → 重试耗尽失败', async () => {
    page.$.mockResolvedValue(null);
    const r = await run(() => adapter.navigateToPublish(page as never));
    expect(r.success).toBe(false);
    expect(r.error).toContain('无法导航到发布页面');
  });

  it('navigateToPublish：异常路径记录错误', async () => {
    page.goto.mockRejectedValue(new Error('x'));
    const r = await run(() => adapter.navigateToPublish(page as never));
    expect(r.success).toBe(false);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'douyin_navigate_error' }),
    );
  });

  it('uploadMaterial：找到文件控件并上传', async () => {
    const setInputFiles = jest.fn().mockResolvedValue(undefined);
    page.$.mockResolvedValue({ setInputFiles });
    const r = await run(() => adapter.uploadMaterial(page as never, 'C:/v.mp4'));
    expect(r.success).toBe(true);
    expect(setInputFiles).toHaveBeenCalledWith('C:/v.mp4');
  });

  it('uploadMaterial：控件缺失重试耗尽', async () => {
    page.$.mockResolvedValue(null);
    const r = await run(() => adapter.uploadMaterial(page as never, 'C:/v.mp4'));
    expect(r.success).toBe(false);
    expect(r.error).toContain('上传素材失败');
  });
});
