import { BrowserGateway } from './BrowserGateway';
import { CircuitBreakerState } from './circuit-breaker';

/**
 * BrowserGateway 测试：池 + 熔断器 + 执行器编排。
 * BrowserPool 以 mock 注入（不启动真实 Chromium），验证熔断开路拒绝、
 * 获取失败路径、成功/失败时熔断计数、页面释放、状态导出。
 */
jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn(),
  },
}));

describe('BrowserGateway', () => {
  let gw: BrowserGateway;
  let audit: { record: jest.Mock };
  let poolInst: {
    id: string;
    browser: unknown;
    init: jest.Mock;
    getPage: jest.Mock;
    returnPage: jest.Mock;
    close: jest.Mock;
    isIdle: boolean;
    lastUsed: number;
    createdAt: number;
  };

  const mkGateway = () => {
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    const g = new BrowserGateway(audit as never);
    // 注入 mock 实例到池中，绕过真实 Chromium
    poolInst = {
      id: 'instance-0',
      browser: {},
      init: jest.fn().mockResolvedValue(undefined),
      getPage: jest.fn().mockResolvedValue({
        url: jest.fn().mockReturnValue('https://example.com'),
        title: jest.fn().mockResolvedValue('T'),
        screenshot: jest.fn().mockResolvedValue(Buffer.from('png')),
        goto: jest.fn().mockResolvedValue(undefined),
        waitForSelector: jest.fn().mockResolvedValue(undefined),
        evaluate: jest.fn().mockResolvedValue(undefined),
        click: jest.fn().mockResolvedValue(undefined),
        fill: jest.fn().mockResolvedValue(undefined),
      }),
      returnPage: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
      isIdle: true,
      lastUsed: Date.now(),
      createdAt: Date.now(),
    };
    (
      g as unknown as {
        pool: {
          instances: Map<string, unknown>;
          getInstance: unknown;
          releaseInstance: unknown;
          getStats: unknown;
          destroy: unknown;
          options: { maxInstances: number };
        };
      }
    ).pool = {
      instances: new Map([[poolInst.id, poolInst]]),
      getInstance: jest.fn().mockResolvedValue(poolInst),
      releaseInstance: jest.fn(),
      destroy: jest.fn().mockResolvedValue(undefined),
      getStats: jest.fn().mockReturnValue({
        totalInstances: 1,
        activeInstances: 1,
        idleInstances: 0,
        totalPagesCreated: 1,
        totalPagesClosed: 0,
        averageLifetimeMs: 0,
      }),
      options: { maxInstances: 5 },
    };
    return g;
  };

  beforeEach(() => {
    gw = mkGateway();
  });

  afterEach(async () => {
    await gw.onModuleDestroy();
  });

  it('executeSequence：成功路径回填结果并释放页面', async () => {
    const r = await gw.executeSequence([{ type: 'screenshot', payload: 'screenshot' } as never]);
    expect(r.success).toBe(true);
    expect(r.screenshot).toBe(Buffer.from('png').toString('base64'));
    expect(r.url).toBe('https://example.com');
    expect(r.title).toBe('T');
    expect(poolInst.returnPage).toHaveBeenCalled();
  });

  it('executeSequence 成功后实例归还空闲（否则实例泄漏 → 池耗尽后工作台报废）', async () => {
    await gw.executeSequence([{ type: 'screenshot', payload: 'screenshot' } as never]);
    const pool = (gw as unknown as { pool: { releaseInstance: jest.Mock } }).pool;
    expect(poolInst.returnPage).toHaveBeenCalled();
    expect(pool.releaseInstance).toHaveBeenCalledWith(poolInst);
  });

  it('执行抛异常时同样归还实例回空闲，避免泄漏', async () => {
    (gw as unknown as { executor: { executeSequence: jest.Mock } }).executor.executeSequence = jest
      .fn()
      .mockRejectedValue(new Error('boom'));
    await gw.executeSequence([{ type: 'screenshot', payload: 'screenshot' } as never]);
    const pool = (gw as unknown as { pool: { releaseInstance: jest.Mock } }).pool;
    expect(pool.releaseInstance).toHaveBeenCalledWith(poolInst);
  });

  it('池满（getInstance=null）返回失败且不计熔断成功', async () => {
    (gw as unknown as { pool: { getInstance: jest.Mock } }).pool.getInstance = jest
      .fn()
      .mockResolvedValue(null);
    const r = await gw.executeSequence([{ type: 'screenshot', payload: 'screenshot' } as never]);
    expect(r.success).toBe(false);
    expect(r.error).toContain('No available browser pool instance');
  });

  it('getPage 初始化失败：释放实例、计入熔断失败并返回无可用实例', async () => {
    poolInst.browser = null;
    poolInst.init.mockRejectedValue(new Error('launch failed'));
    const r = await gw.executeSequence([{ type: 'screenshot', payload: 'screenshot' } as never]);
    // getBrowserPage 捕获 init 异常后返回 null → executeSequence 归一化为「无可用实例」
    expect(r.success).toBe(false);
    expect(r.error).toContain('No available browser pool instance');
    expect(
      (gw as unknown as { pool: { releaseInstance: jest.Mock } }).pool.releaseInstance,
    ).toHaveBeenCalledWith(poolInst);
  });

  it('执行抛异常：返回失败并仍尝试释放页面', async () => {
    (gw as unknown as { executor: { executeSequence: jest.Mock } }).executor.executeSequence = jest
      .fn()
      .mockRejectedValue(new Error('boom'));
    const r = await gw.executeSequence([{ type: 'screenshot', payload: 'screenshot' } as never]);
    expect(r.success).toBe(false);
    expect(r.error).toBe('boom');
  });

  it('熔断器开路时直接拒绝', async () => {
    // 连续失败 3 次触发熔断（failureThreshold=3）
    poolInst.browser = null;
    poolInst.init.mockRejectedValue(new Error('x'));
    for (let i = 0; i < 3; i++) {
      await gw.executeSequence([{ type: 'screenshot', payload: 'screenshot' } as never]);
    }
    const r = await gw.executeSequence([{ type: 'screenshot', payload: 'screenshot' } as never]);
    expect(r.success).toBe(false);
    expect(r.error).toContain('circuit breaker open');
  });

  it('closeInstance 关闭指定实例', async () => {
    const ok = await gw.closeInstance('instance-0');
    expect(ok).toBe(true);
    expect(poolInst.close).toHaveBeenCalled();
  });

  it('closeInstance 未知实例返回 false', async () => {
    expect(await gw.closeInstance('nope')).toBe(false);
  });

  it('getStatus 导出池与熔断状态', () => {
    const s = gw.getStatus();
    expect(s.ready).toBe(false); // 未预热
    expect(s.circuitBreakerState).toBe(CircuitBreakerState.Closed);
    expect(s.poolMax).toBe(5);
    expect(s.poolStats.totalInstances).toBe(1);
  });

  it('onModuleDestroy 委托 pool.destroy（含定时器与实例清理）', async () => {
    await gw.onModuleDestroy();
    // 真实 close 行为由 BrowserPool.destroy 保证（见 browser-pool.spec）
    expect((gw as unknown as { pool: { destroy: jest.Mock } }).pool.destroy).toHaveBeenCalled();
  });
});
