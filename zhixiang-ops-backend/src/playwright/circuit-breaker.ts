/**
 * 熔断器模式
 * 防止级联故障，当平台不可用时快速失败并允许恢复
 *
 * 状态机：
 *   Closed（正常）--失败达阈值--> Open（跳闸，快速拒绝）
 *   Open --resetTimeout 到期--> HalfOpen（放行有限探测请求）
 *   HalfOpen --探测成功--> Closed（恢复） | --探测失败--> Open（重新跳闸）
 */

export enum CircuitBreakerState {
  Closed = 'closed', // 正常状态，请求通过
  Open = 'open', // 跳闸状态，拒绝请求
  HalfOpen = 'half-open', // 半开状态，有限制的请求测试
}

export interface CircuitBreakerOptions {
  failureThreshold: number; // 失败阈值
  resetTimeout: number; // 重置超时时间(毫秒)
  halfOpenMaxCalls: number; // 半开最大探测成功数
}

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.Closed;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private resetTimeoutId: NodeJS.Timeout | null = null;
  private options: CircuitBreakerOptions;

  constructor(options: CircuitBreakerOptions) {
    this.options = {
      failureThreshold: options.failureThreshold || 5,
      resetTimeout: options.resetTimeout || 30000,
      halfOpenMaxCalls: options.halfOpenMaxCalls || 3,
    };
  }

  /**
   * 记录一次调用结果（状态机推进）
   */
  recordResult(success: boolean): void {
    if (success) {
      this.failureCount = 0;
      this.successCount++;

      // Open/HalfOpen 下的成功证明服务已恢复 → 直接闭合
      if (this.state !== CircuitBreakerState.Closed) {
        this.state = CircuitBreakerState.Closed;
        this.successCount = 0;
        this.clearResetTimer();
      }
    } else {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      if (this.state === CircuitBreakerState.HalfOpen) {
        // 半开探测失败 → 立即重新跳闸
        this.tripOpen();
      } else if (
        this.state !== CircuitBreakerState.Open &&
        this.failureCount >= this.options.failureThreshold
      ) {
        // 闭合状态下失败达阈值 → 跳闸
        this.tripOpen();
      }
    }
  }

  /** 进入 Open 并启动恢复定时器 */
  private tripOpen(): void {
    this.state = CircuitBreakerState.Open;
    this.successCount = 0;
    this.clearResetTimer();
    this.resetTimeoutId = setTimeout(() => {
      // 超时后放行探测请求
      if (this.state === CircuitBreakerState.Open) {
        this.state = CircuitBreakerState.HalfOpen;
        this.successCount = 0;
      }
      this.resetTimeoutId = null;
    }, this.options.resetTimeout);
    // 定时器不应阻止进程退出
    this.resetTimeoutId.unref?.();
  }

  private clearResetTimer(): void {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }
  }

  /**
   * 执行带熔断保护的异步操作：
   * - Open：快速失败
   * - HalfOpen：成功数达上限后拒绝，否则放行探测
   * - Closed：直接执行并记录结果
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.Open) {
      throw new Error('Circuit breaker is open. Service temporarily unavailable.');
    }
    if (
      this.state === CircuitBreakerState.HalfOpen &&
      this.successCount >= this.options.halfOpenMaxCalls
    ) {
      throw new Error('Circuit breaker half-open: max calls reached');
    }

    try {
      const result = await operation();
      this.recordResult(true);
      return result;
    } catch (error) {
      this.recordResult(false);
      throw error;
    }
  }

  /**
   * 手动关闭熔断器（用于恢复服务）
   */
  forceClose(): void {
    this.state = CircuitBreakerState.Closed;
    this.failureCount = 0;
    this.successCount = 0;
    this.clearResetTimer();
  }

  /**
   * 获取当前状态
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    state: CircuitBreakerState;
    failureCount: number;
    successCount: number;
    lastFailureTime: number;
    uptime: number;
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      uptime: Date.now() - this.lastFailureTime,
    };
  }
}
