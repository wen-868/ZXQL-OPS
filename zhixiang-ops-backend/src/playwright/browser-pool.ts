/**
 * 浏览器实例池
 * 管理有界数量的浏览器实例，支持自动预热、回收和并发控制
 * 对于生产环境中的并发自动化至关重要
 */

import { Browser, BrowserContext, Page, chromium } from 'playwright';
import { Logger } from '../shared/logger';
import { errMessage } from './err-msg';

const logger = Logger.getInstance();

export interface PoolOptions {
  maxInstances: number; // 最大实例数
  maxPagesPerInstance: number; // 每实例最大页面数
  keepAliveMs: number; // 保持存活时间 (防止内存泄漏)
  warmupPages: number; // 预热时的页面数
  cleanupIdleMs: number; // 空闲清理间隔
}

export interface PoolStats {
  totalInstances: number;
  activeInstances: number;
  idleInstances: number;
  totalPagesCreated: number;
  totalPagesClosed: number;
  averageLifetimeMs: number;
}

export class BrowserPool {
  public instances: Map<string, PoolInstance> = new Map();
  public stats: PoolStats = {
    totalInstances: 0,
    activeInstances: 0,
    idleInstances: 0,
    totalPagesCreated: 0,
    totalPagesClosed: 0,
    averageLifetimeMs: 0,
  };
  public options: PoolOptions;
  private idleTimer: NodeJS.Timeout | null = null;

  constructor(options: PoolOptions) {
    this.options = {
      maxInstances: options.maxInstances || 5,
      maxPagesPerInstance: options.maxPagesPerInstance || 10,
      keepAliveMs: options.keepAliveMs || 300000, // 5分钟
      warmupPages: options.warmupPages || 2,
      cleanupIdleMs: options.cleanupIdleMs || 60000, // 1分钟
    };

    // 实例池改为按租户惰性创建（预建实例无法预知租户归属，
    // 会导致 A 租户用户复用 B 租户遗留登录态/Cookie 的跨租户污染）

    // 启动空闲清理循环
    this.startIdleCleanup();
  }

  /**
   * 获取一个可用的浏览器实例（租户隔离：仅复用同租户实例）。
   * 内部逻辑为同步（池内实例均为本地对象），async 仅为统一调用方 await 习惯。
   */
  // eslint-disable-next-line @typescript-eslint/require-await -- 保持异步签名以兼容调用方
  async getInstance(tenantId = 'system'): Promise<PoolInstance | null> {
    // 优先获取同租户空闲实例（页面状态/Cookie 只在本租户实例内流转）
    for (const [, instance] of this.instances) {
      if (
        instance.tenantId === tenantId &&
        instance.isIdle &&
        instance.pages.length < this.options.maxPagesPerInstance
      ) {
        instance.markUsed();
        this.stats.activeInstances++;
        this.stats.idleInstances--;
        logger.info('Browser pool: 分配空闲实例', {
          instanceId: instance.id,
          tenantId,
        });
        return instance;
      }
    }

    // 没有同租户空闲实例且未达到上限，创建新实例
    if (this.instances.size < this.options.maxInstances) {
      const newId = `instance-${this.stats.totalInstances + 1}`;
      const newInstance = new PoolInstance(this, newId, tenantId);
      this.instances.set(newId, newInstance);
      this.stats.totalInstances++;
      // 必须立即标记占用：否则下次 getInstance 会把同一「新建」实例再分配给其他请求
      newInstance.markUsed();
      this.stats.activeInstances++;
      logger.info('Browser pool: 创建新实例', { instanceId: newId, tenantId });
      return newInstance;
    }

    // 达上限，返回 null (调用者需要等待或排队)
    logger.warn('Browser pool: 所有实例均已满，请求将等待', { poolSize: this.instances.size });
    return null;
  }

  /**
   * 释放浏览器实例
   */
  releaseInstance(instance: PoolInstance): void {
    const id = instance.id;
    if (this.instances.has(id)) {
      this.instances.get(id)!.markIdle();
      this.stats.activeInstances--;
      this.stats.idleInstances++;
      logger.info('Browser pool: 释放实例', { instanceId: id });
    }
  }

  /**
   * 获取池统计信息
   */
  getStats(): PoolStats {
    // 重新计算空闲实例数
    let idleCount = 0;
    for (const instance of this.instances.values()) {
      if (instance.isIdle) idleCount++;
    }
    return {
      totalInstances: this.instances.size,
      activeInstances: this.stats.activeInstances,
      idleInstances: idleCount,
      totalPagesCreated: this.stats.totalPagesCreated,
      totalPagesClosed: this.stats.totalPagesClosed,
      averageLifetimeMs: this.stats.averageLifetimeMs,
    };
  }

  /**
   * 启动空闲清理定时器。
   * unref()：定时器不阻止进程退出（避免测试/Jest 环境因句柄未释放而挂起）。
   */
  private startIdleCleanup(): void {
    // 每分钟清理一次空闲实例
    this.idleTimer = setInterval(() => {
      const now = Date.now();
      for (const [, instance] of this.instances) {
        // 如果实例已空闲超过保持时间，且页面已关闭，则销毁
        if (instance.isIdle && instance.lastUsed < now - this.options.keepAliveMs) {
          logger.info('Browser pool: 销毁空闲实例', {
            instanceId: instance.id,
            uptime: now - instance.createdAt,
          });
          this.instances.delete(instance.id);
          this.stats.totalInstances--;
        }
      }
    }, this.options.cleanupIdleMs);
    // 不持有事件循环：进程退出时无需等待该定时器，避免测试/热重载挂起
    this.idleTimer.unref?.();
  }

  /**
   * 销毁池：清理定时器并关闭全部实例（模块卸载/测试收尾调用，防资源泄漏）。
   */
  async destroy(): Promise<void> {
    if (this.idleTimer) {
      clearInterval(this.idleTimer);
      this.idleTimer = null;
    }
    for (const instance of this.instances.values()) {
      await instance.close().catch(() => undefined);
    }
    this.instances.clear();
  }
}

/**
 * 浏览器池中的单个实例
 */
export class PoolInstance {
  public createdAt: number;
  public lastUsed: number;
  public isUsed: boolean;
  public browser: Browser | null = null;
  public context: BrowserContext | null = null;
  public pages: Page[] = [];

  constructor(
    private pool: BrowserPool,
    public id: string,
    public tenantId: string = 'system',
  ) {
    this.createdAt = Date.now();
    this.lastUsed = this.createdAt;
    this.isUsed = false;
    this.pages = [];
    this.context = null;
  }

  /** 是否空闲（未被占用） */
  get isIdle(): boolean {
    return !this.isUsed;
  }

  /**
   * 初始化浏览器实例
   */
  async init(): Promise<void> {
    try {
      const browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-blink-features=AutomationControlled',
          // 注：不启用 --disable-web-security（同源策略关停会把服务端浏览器变成
          // 任意站点可读的代理；反检测通过 UA 与 AutomationControlled 移除已足够）
          '--disable-notifications',
        ],
      });
      this.browser = browser;

      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      });
      this.context = context;

      // 预热：打开预定义数量的页面
      for (let i = 0; i < (this.pool.options?.warmupPages || 2); i++) {
        const page = await context.newPage();
        this.pages.push(page);
        this.pool.stats.totalPagesCreated++;
      }

      logger.info('Browser pool instance initialized', { instanceId: this.id });
    } catch (error: unknown) {
      logger.error('Browser pool instance init failed', {
        instanceId: this.id,
        error: errMessage(error),
      });
      throw error;
    }
  }

  /**
   * 获取一个页面 (复用预热页面或创建新页面)
   */
  async getPage(): Promise<Page> {
    // 优先复用预热页面（后进先出）：最近归还的页面优先再取用，保证同一会话内
    // 相邻指令落在同一页面。若用 shift 轮转，warmupPages>1 时相邻指令会交替落在
    // 不同页面，导致地址/表单状态漂移（表现为状态里 URL 忽变为 about:blank）。
    if (this.pages.length > 0) {
      const page = this.pages.pop()!;
      this.lastUsed = Date.now();
      return page;
    }

    // 创建新页面
    if (this.context) {
      const page = await this.context.newPage();
      this.lastUsed = Date.now();
      return page;
    }

    throw new Error('Browser context not initialized. Call init() first.');
  }

  /**
   * 归还页面到池中 (不关闭页面，保持状态)
   */
  returnPage(page: Page): void {
    // 页面归还到池末尾，保供后续复用
    if (
      !this.pages.includes(page) &&
      this.pages.length < (this.pool.options?.maxPagesPerInstance || 10)
    ) {
      this.pages.push(page);
    }
  }

  /**
   * 标记为使用中
   */
  markUsed(): void {
    this.isUsed = true;
    this.lastUsed = Date.now();
  }

  /**
   * 标记为空闲
   */
  markIdle(): void {
    this.isUsed = false;
  }

  /**
   * 关闭实例并清理资源
   */
  async close(): Promise<void> {
    try {
      // 关闭所有页面
      for (const page of this.pages) {
        await page.close().catch(() => {});
      }
      this.pages = [];

      // 关闭上下文
      if (this.context) {
        await this.context.close().catch(() => {});
        this.context = null;
      }

      // 关闭浏览器
      if (this.browser) {
        await this.browser.close().catch(() => {});
        this.browser = null;
      }

      logger.info('Browser pool instance closed', { instanceId: this.id });
    } catch (error: unknown) {
      logger.error('Browser pool instance close error', {
        instanceId: this.id,
        error: errMessage(error),
      });
    }
  }
}
