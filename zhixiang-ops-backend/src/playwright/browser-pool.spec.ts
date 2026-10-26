import { BrowserPool, PoolInstance } from './browser-pool';

/**
 * 浏览器实例池测试（不启动真实 Chromium：init 由 mock 注入）。
 * 覆盖：按租户惰性建实例、租户隔离分配、上限控制、空闲清理、页面复用与归还、统计。
 */
jest.mock('playwright', () => {
  const mkPage = () => Promise.resolve({ close: jest.fn().mockResolvedValue(undefined) });
  const mkContext = () =>
    Promise.resolve({
      newPage: mkPage,
      close: jest.fn().mockResolvedValue(undefined),
    });
  return {
    chromium: {
      launch: jest.fn().mockResolvedValue({
        newContext: mkContext,
        close: jest.fn().mockResolvedValue(undefined),
      }),
    },
  };
});

describe('BrowserPool', () => {
  const opts = {
    maxInstances: 2,
    maxPagesPerInstance: 3,
    keepAliveMs: 50,
    warmupPages: 1,
    cleanupIdleMs: 10,
  };

  afterEach(() => {
    jest.clearAllTimers();
  });

  it('构造时惰性建池（不预建实例）', () => {
    const pool = new BrowserPool(opts);
    expect(pool.instances.size).toBe(0);
    expect(pool.options.maxInstances).toBe(2);
  });

  it('getInstance 按租户创建实例并标记占用', async () => {
    const pool = new BrowserPool(opts);
    const inst = await pool.getInstance('t1');
    expect(inst).not.toBeNull();
    expect(inst!.isIdle).toBe(false);
    expect(inst!.tenantId).toBe('t1');
    const stats = pool.getStats();
    expect(stats.totalInstances).toBe(1);
    expect(stats.idleInstances).toBe(0);
  });

  it('同租户空闲实例优先复用', async () => {
    const pool = new BrowserPool(opts);
    const a = await pool.getInstance('t1');
    pool.releaseInstance(a!);
    const b = await pool.getInstance('t1');
    expect(b).toBe(a);
  });

  it('跨租户不复用实例（租户隔离）', async () => {
    const pool = new BrowserPool(opts);
    const a = await pool.getInstance('t1');
    pool.releaseInstance(a!); // t1 实例空闲
    const b = await pool.getInstance('t2');
    expect(b).not.toBe(a);
    expect(b!.tenantId).toBe('t2');
  });

  it('全部占用且达上限时返回 null', async () => {
    const pool = new BrowserPool(opts);
    const a = await pool.getInstance('t1');
    const b = await pool.getInstance('t2');
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    const c = await pool.getInstance('t1');
    expect(c).toBeNull();
  });

  it('releaseInstance 归还后可再次分配', async () => {
    const pool = new BrowserPool(opts);
    const inst = (await pool.getInstance('t1'))!;
    pool.releaseInstance(inst);
    expect(inst.isIdle).toBe(true);
    const again = await pool.getInstance('t1');
    expect(again).not.toBeNull();
  });

  it('PoolInstance.init 创建 browser/context 并预热页面', async () => {
    const pool = new BrowserPool(opts);
    const inst = (await pool.getInstance('t1'))!;
    await inst.init();
    expect(inst.browser).not.toBeNull();
    expect(inst.context).not.toBeNull();
    expect(inst.pages).toHaveLength(1); // warmupPages=1
  });

  it('getPage 优先复用预热页面', async () => {
    const pool = new BrowserPool(opts);
    const inst = (await pool.getInstance('t1'))!;
    await inst.init();
    const prewarmed = inst.pages[0];
    const p = await inst.getPage();
    expect(p).toBe(prewarmed);
    expect(inst.pages).toHaveLength(0);
  });

  it('getPage 预热用尽后新建页面', async () => {
    const pool = new BrowserPool(opts);
    const inst = (await pool.getInstance('t1'))!;
    await inst.init();
    await inst.getPage(); // 取走预热的
    const p2 = await inst.getPage();
    expect(p2).not.toBeNull();
  });

  it('预热多页时后进先出：取用-归还循环始终复用同一页面（会话状态连续）', async () => {
    const pool = new BrowserPool({ ...opts, warmupPages: 2, maxPagesPerInstance: 5 });
    const inst = (await pool.getInstance('t1'))!;
    await inst.init();
    expect(inst.pages).toHaveLength(2);

    const first = await inst.getPage();
    inst.returnPage(first);
    const second = await inst.getPage();
    // shift 轮转会让第二次取到另一页（状态漂移）；pop 保证再次拿到同一页
    expect(second).toBe(first);
  });

  it('取页-还页-释放实例后，同租户再次分配仍复用该实例（不新建）', async () => {
    const pool = new BrowserPool(opts);
    const inst = (await pool.getInstance('t1'))!;
    await inst.init();
    const page = await inst.getPage();
    inst.returnPage(page);
    pool.releaseInstance(inst); // BrowserGateway.releaseBrowserPage 的归还语义
    const again = await pool.getInstance('t1');
    expect(again).toBe(inst);
    expect(pool.getStats().totalInstances).toBe(1);
  });

  it('未 init 就 getPage 抛错', async () => {
    const inst = new PoolInstance(new BrowserPool(opts), 'x', 't1');
    await expect(inst.getPage()).rejects.toThrow('not initialized');
  });

  it('returnPage 归还到池尾且不超上限', async () => {
    const pool = new BrowserPool(opts);
    const inst = (await pool.getInstance('t1'))!;
    await inst.init();
    const p1 = await inst.getPage();
    inst.returnPage(p1);
    expect(inst.pages).toContain(p1);
    // 超上限的归还被忽略
    for (let i = 0; i < 5; i++) inst.returnPage({} as never);
    expect(inst.pages.length).toBeLessThanOrEqual(3);
  });

  it('close 关闭全部页面/上下文/浏览器', async () => {
    const pool = new BrowserPool(opts);
    const inst = (await pool.getInstance('t1'))!;
    await inst.init();
    const browser = inst.browser!;
    await inst.close();
    expect(inst.browser).toBeNull();
    expect(inst.context).toBeNull();
    expect(inst.pages).toHaveLength(0);
    expect(browser.close).toHaveBeenCalled();
  });

  it('空闲超过 keepAliveMs 的实例被清理定时器销毁', async () => {
    jest.useFakeTimers();
    const pool = new BrowserPool({ ...opts, keepAliveMs: 10, cleanupIdleMs: 10 });
    try {
      const inst = (await pool.getInstance('t1'))!;
      pool.releaseInstance(inst);
      // 释放后空闲 10ms+
      jest.advanceTimersByTime(100);
      expect(pool.instances.has(inst.id)).toBe(false);
    } finally {
      // 显式销毁：清理定时器，避免测试结束后回调仍触发
      await pool.destroy();
    }
  });

  it('destroy 清理定时器并关闭全部实例', async () => {
    jest.useFakeTimers();
    const pool = new BrowserPool({ ...opts, keepAliveMs: 10, cleanupIdleMs: 10 });
    const inst = (await pool.getInstance('t1'))!;
    // 用 spy 观测 close 调用（close 为实例方法，非 jest.fn）
    const closeSpy = jest.spyOn(inst, 'close').mockResolvedValue(undefined);
    pool.releaseInstance(inst);
    await pool.destroy();
    // 定时器已清理：推进时间不再产生销毁动作
    jest.advanceTimersByTime(200);
    expect(pool.instances.size).toBe(0);
    expect(closeSpy).toHaveBeenCalled();
    closeSpy.mockRestore();
  });

  it('getStats 反映创建数', async () => {
    const pool = new BrowserPool(opts);
    await pool.getInstance('t1');
    await pool.getInstance('t2');
    const s = pool.getStats();
    expect(s.totalInstances).toBe(2);
  });
});
