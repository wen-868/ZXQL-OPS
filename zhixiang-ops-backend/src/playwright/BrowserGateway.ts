import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { env } from '../config/env';
import { AuditService } from '../modules/n/audit.service';
import { TenantContext } from '../tenant/tenant-context';
import { Page } from 'playwright';
import { BrowserPool } from './browser-pool';
import { CircuitBreaker, CircuitBreakerState } from './circuit-breaker';
import { errMessage } from './err-msg';
import { InstructionExecutor, ExecuteResult } from './instruction-executor';
import { Instruction } from './directive-parser';

@Injectable()
export class BrowserGateway implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BrowserGateway.name);

  /** 惰性租户：模块构造时无请求上下文，不能在构造函数里 requireTenantId */
  private getTenantId(): string {
    return TenantContext.getTenantId() ?? 'system';
  }

  // 实例池 - 管理并发浏览器实例
  private readonly pool: BrowserPool;

  // 熔断器 - 防止级联故障
  private readonly circuitBreaker: CircuitBreaker;

  // 指令执行器
  private readonly executor: InstructionExecutor;

  // 就绪状态（首个实例预热完成后为 true）
  private ready = false;

  constructor(private readonly auditService: AuditService) {
    // 初始化实例池（容量经 env 可配：OPS_BROWSER_MAX_INSTANCES 等，
    // 多租户并发工作时按机器内存与并发租户数调整）
    this.pool = new BrowserPool({
      maxInstances: Number(env.OPS_BROWSER_MAX_INSTANCES) || 5,
      maxPagesPerInstance: Number(env.OPS_BROWSER_MAX_PAGES_PER_INSTANCE) || 10,
      keepAliveMs: Number(env.OPS_BROWSER_KEEP_ALIVE_MS) || 300000, // 5分钟保持存活
      warmupPages: 2, // 每实例预热2个页面
      cleanupIdleMs: Number(env.OPS_BROWSER_CLEANUP_IDLE_MS) || 60000, // 1分钟清理一次空闲实例
    });

    // 初始化熔断器
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 3, // 3次失败熔断
      resetTimeout: 10000, // 10秒后尝试恢复
      halfOpenMaxCalls: 1, // 半开状态1次机会
    });

    // 初始化指令执行器
    this.executor = new InstructionExecutor(3, 1000); // 最多3次重试，1秒间隔
  }

  onModuleInit(): void {
    // 后台预热首个实例（不阻塞 NestJS 启动；即发即弃，失败自带降级）
    void this.warmupOneInstance();
  }

  /** 后台预热单个浏览器实例 */
  private async warmupOneInstance(): Promise<void> {
    try {
      // 预热归入 system 租户，避免占用的实例被业务租户请求分配
      const instance = await this.pool.getInstance('system');
      if (instance && !instance.browser) {
        await instance.init();
        this.ready = true;
        this.logger.log(`Browser pool instance ${instance.id} warmed up`);
      } else if (instance) {
        this.ready = true;
      }
    } catch (error: unknown) {
      this.logger.error('Browser pool warmup failed (will retry on first use)', {
        error: errMessage(error),
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    // 关闭池中所有实例并清理空闲清理定时器（防句柄泄漏）
    await this.pool.destroy();
    this.logger.log('BrowserGateway module destroyed, all browser instances closed');
  }

  /**
   * 获取一个浏览器实例和页面 (通过池管理)
   */
  async getBrowserPage(): Promise<{ page: Page; instanceId: string } | null> {
    // 熔断器检查
    if (this.circuitBreaker.getState() === CircuitBreakerState.Open) {
      this.logger.warn('Circuit breaker is open, rejecting browser page request');
      return null;
    }

    // 按当前租户分配实例（租户隔离：不复用其他租户的页面状态）
    const poolInstance = await this.pool.getInstance(this.getTenantId());
    if (!poolInstance) {
      return null;
    }

    let page: Page | null = null;
    try {
      // 初始化实例（如果尚未初始化）
      if (!poolInstance.browser) {
        await poolInstance.init();
      }

      // 获取页面
      page = await poolInstance.getPage();

      // 记录审计（审计失败不应中断取页，否则已开页面会留在实例中泄漏）
      try {
        await this.auditService.record({
          action: 'browser_pool_page_get',
          module: 'browser-workbench',
          resource: `pool:${poolInstance.id}`,
        });
      } catch (auditErr: unknown) {
        this.logger.warn('browser_pool_page_get audit failed', {
          error: errMessage(auditErr),
        });
      }

      return { page, instanceId: poolInstance.id };
    } catch (error: unknown) {
      this.logger.error('Failed to get browser page from pool', {
        error: errMessage(error),
        instanceId: poolInstance.id,
      });

      // 已取出的页面必须关闭，避免泄漏
      if (page) {
        await page.close().catch(() => undefined);
      }

      // 记录错误到熔断器
      this.circuitBreaker.recordResult(false);

      // 释放有问题的实例
      this.pool.releaseInstance(poolInstance);
      return null;
    }
  }

  /**
   * 释放浏览器页面回池
   */
  releaseBrowserPage(instanceId: string, page: Page): void {
    const poolInstance = this.pool.instances.get(instanceId);
    if (poolInstance) {
      poolInstance.returnPage(page);
      // 必须把实例标记回空闲：getInstance 仅复用 isIdle 实例，若只归还页面不释放实例，
      // 实例会永久处于占用态 → 每条指令新建实例，达 maxInstances 后返回 null，
      // 工作台在几条指令后彻底不可用（且空闲清理也只回收 isIdle 实例，无法自愈）
      this.pool.releaseInstance(poolInstance);
      this.circuitBreaker.recordResult(true);

      this.logger.log('Browser page released to pool', { instanceId });

      // 记录审计（审计失败不应影响页面释放，void 忽略但已由 AuditService 内部兜错）
      void this.auditService.record({
        action: 'browser_pool_page_release',
        module: 'browser-workbench',
        resource: `pool:${instanceId}`,
      });
    }
  }

  /**
   * 执行指令序列 (带熔断和池管理)
   */
  async executeSequence(
    instructions: Instruction[],
    options?: { timeout?: number; onRetry?: (attempt: number) => void },
  ): Promise<ExecuteResult> {
    // 熔断器检查
    if (this.circuitBreaker.getState() === CircuitBreakerState.Open) {
      return {
        success: false,
        error: 'Service temporarily unavailable - circuit breaker open',
        duration: 0,
        retryCount: 0,
      };
    }

    const startTime = Date.now();

    // 从池获取页面
    const acquired = await this.getBrowserPage();
    if (!acquired) {
      return {
        success: false,
        error: 'No available browser pool instance',
        duration: 0,
        retryCount: 0,
      };
    }
    const { page, instanceId } = acquired;

    try {
      // 执行指令序列
      const result = await this.executor.executeSequence(instructions, page, options?.onRetry);

      // 根据结果更新熔断器
      if (result.success) {
        this.circuitBreaker.recordResult(true);
      } else {
        this.circuitBreaker.recordResult(false);
      }

      // 释放页面回池
      this.releaseBrowserPage(instanceId, page);

      const duration = Date.now() - startTime;
      return {
        success: result.success,
        error: result.error,
        screenshot: result.screenshot,
        url: result.url,
        title: result.title,
        duration,
        retryCount: result.retryCount,
      };
    } catch (err: unknown) {
      this.circuitBreaker.recordResult(false);

      // 释放页面（失败静默：主错误优先上抛）
      try {
        this.releaseBrowserPage(instanceId, page);
      } catch {
        /* ignore */
      }

      const duration = Date.now() - startTime;
      return {
        success: false,
        error: errMessage(err),
        duration,
        retryCount: 0,
      };
    }
  }

  /**
   * 关闭特定浏览器实例 (用于人工接管等场景)
   */
  async closeInstance(instanceId: string): Promise<boolean> {
    const poolInstance = this.pool.instances.get(instanceId);
    if (!poolInstance) {
      return false;
    }

    try {
      await poolInstance.close();
      this.pool.releaseInstance(poolInstance);
      this.logger.log('Browser instance closed manually', { instanceId });
      return true;
    } catch (error: unknown) {
      this.logger.error('Failed to close browser instance', {
        instanceId,
        error: errMessage(error),
      });
      return false;
    }
  }

  /**
   * 获取系统状态
   */
  getStatus() {
    return {
      ready: this.ready,
      circuitBreakerState: this.circuitBreaker.getState(),
      poolStats: this.pool.getStats(),
      poolMax: this.pool.options.maxInstances,
      tenantId: this.getTenantId(),
    };
  }
}
