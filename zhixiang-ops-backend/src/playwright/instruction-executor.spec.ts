import { InstructionExecutor } from './instruction-executor';
import { parseInstruction } from './directive-parser';
import type { Page } from 'playwright';

/**
 * 指令执行器行为测试：mock Playwright Page 驱动真实执行路径。
 * 覆盖：navigate/click/input/wait/screenshot 五类指令、重试与退避、
 * 不可重试错误短路、序列中断、url/title 回填、历史记录。
 */
describe('InstructionExecutor', () => {
  let executor: InstructionExecutor;
  /** 同时暴露 Page 契约与 jest.Mock 能力的测试替身 */
  let page: Page;
  let pageMock: {
    goto: jest.Mock;
    waitForSelector: jest.Mock;
    evaluate: jest.Mock;
    click: jest.Mock;
    fill: jest.Mock;
    screenshot: jest.Mock;
    waitForTimeout: jest.Mock;
    url: jest.Mock;
    title: jest.Mock;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    executor = new InstructionExecutor(2, 10); // 最多2次重试，10ms 间隔
    pageMock = {
      goto: jest.fn().mockResolvedValue(undefined),
      waitForSelector: jest.fn().mockResolvedValue(undefined),
      evaluate: jest.fn().mockResolvedValue(undefined),
      click: jest.fn().mockResolvedValue(undefined),
      fill: jest.fn().mockResolvedValue(undefined),
    screenshot: jest.fn().mockResolvedValue(Buffer.from('png')),
    waitForTimeout: jest.fn().mockResolvedValue(undefined),
    url: jest.fn().mockReturnValue('https://example.com/page'),
      title: jest.fn().mockResolvedValue('页面标题'),
    };
    // 类型收紧为 playwright Page 后，mock 以 as unknown as Page 注入
    page = pageMock as unknown as Page;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const run = async (cmds: string[]) => {
    const p = executor.executeSequence(
      cmds.map((c) => parseInstruction(c)),
      page,
    );
    // 推进重试退避的 setTimeout
    await jest.runAllTimersAsync();
    return p;
  };

  it('navigate：调用 goto(domcontentloaded) 并回填 url/title', async () => {
    const r = await run(['navigate https://example.com']);
    expect(r.success).toBe(true);
    expect(pageMock.goto).toHaveBeenCalledWith('https://example.com', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    expect(pageMock.waitForTimeout).toHaveBeenCalledWith(1500);
    expect(r.url).toBe('https://example.com/page');
    expect(r.title).toBe('页面标题');
  });

  it('navigate 失败：错误信息可读', async () => {
    pageMock.goto.mockRejectedValue(new Error('net::ERR_CONNECTION_REFUSED'));
    const r = await run(['navigate https://example.com']);
    expect(r.success).toBe(false);
    expect(r.error).toContain('导航失败');
  });

  it('click：等可见 → 滚动 → 点击', async () => {
    const r = await run(['click .btn']);
    expect(r.success).toBe(true);
    expect(page.waitForSelector).toHaveBeenCalledWith('.btn', { state: 'visible', timeout: 5000 });
    expect(pageMock.click).toHaveBeenCalledWith('.btn', { timeout: 5000 });
  });

  it('click 失败：返回错误且可重试错误会重试', async () => {
    pageMock.click
      .mockRejectedValueOnce(new Error('TimeoutError: waiting for selector'))
      .mockResolvedValueOnce(undefined);
    const r = await run(['click .btn']);
    expect(r.success).toBe(true);
    expect(pageMock.click).toHaveBeenCalledTimes(2);
    expect(r.retryCount).toBe(1);
  });

  it('不可重试错误不重试', async () => {
    pageMock.click.mockRejectedValue(new Error('strict mode violation: two elements'));
    const r = await run(['click .btn']);
    expect(r.success).toBe(false);
    expect(pageMock.click).toHaveBeenCalledTimes(1);
  });

  it('input：selector:text 拆分后 fill', async () => {
    const r = await run(['input #name:张三']);
    expect(r.success).toBe(true);
    expect(page.fill).toHaveBeenCalledWith('#name', '张三');
  });

  it('input 缺冒号：在解析阶段即被拦截', async () => {
    expect(() => parseInstruction('input #name')).toThrow('input 指令格式');
    // 兜底：executor 层的守卫同样拒绝（防绕过 parser 直接构造）
    const r = executor.executeSequence([{ type: 'input', payload: 'input #name' } as never], page);
    await jest.runAllTimersAsync();
    const res = await r;
    expect(res.success).toBe(false);
    expect(res.error).toContain('格式');
  });

  it('wait：挂起指定毫秒后成功', async () => {
    const r = await run(['wait 100']);
    expect(r.success).toBe(true);
  });

  it('wait 非法数值：失败', async () => {
    const r = executor.executeSequence([{ type: 'wait', payload: 'wait abc' } as never], page);
    await jest.runAllTimersAsync();
    const res = await r;
    expect(res.success).toBe(false);
  });

  it('screenshot：返回 base64', async () => {
    const r = await run(['screenshot']);
    expect(r.success).toBe(true);
    expect(r.screenshot).toBe(Buffer.from('png').toString('base64'));
  });

  it('screenshot 失败：返回错误', async () => {
    pageMock.screenshot.mockRejectedValue(new Error('page closed'));
    const r = await run(['screenshot']);
    expect(r.success).toBe(false);
    expect(r.error).toContain('截图失败');
  });

  it('无效指令格式：中断序列', async () => {
    const r = executor.executeSequence([{ type: 'navigate', payload: 'click .a' } as never], page);
    await jest.runAllTimersAsync();
    const res = await r;
    expect(res.success).toBe(false);
    expect(res.error).toContain('无效的指令格式');
  });

  it('序列中一条失败即中断后续', async () => {
    pageMock.click.mockRejectedValue(new Error('strict mode violation'));
    const r = await run(['click .btn', 'screenshot']);
    expect(r.success).toBe(false);
    expect(pageMock.screenshot).not.toHaveBeenCalled();
  });

  it('多指令全部成功', async () => {
    const r = await run(['navigate https://example.com', 'click .btn', 'input #n:v', 'screenshot']);
    expect(r.success).toBe(true);
    expect(r.retryCount).toBe(0);
  });

  it('执行历史可查询与清空', async () => {
    await run(['screenshot']);
    expect(executor.getExecutionHistory()).toHaveLength(1);
    executor.clearHistory();
    expect(executor.getExecutionHistory()).toHaveLength(0);
  });

  it('pageMock.url() 抛错时仍正常返回（兜底）', async () => {
    pageMock.url.mockImplementation(() => {
      throw new Error('page closed');
    });
    pageMock.title.mockRejectedValue(new Error('page closed'));
    const r = await run(['screenshot']);
    expect(r.success).toBe(true);
    expect(r.url).toBeUndefined();
  });

  it('init() 为 no-op', async () => {
    await expect(executor.init()).resolves.toBeUndefined();
  });
});
