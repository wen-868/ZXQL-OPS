/**
 * 优化的重试策略
 * 支持多种退避策略和智能抖动，防止请求风暴
 */

import { asError, errMessage } from './err-msg';

export enum RetryStrategy {
  Fixed = 'fixed', // 固定间隔
  Exponential = 'exponential', // 指数回退
  WithJitter = 'with-jitter', // 带抖动
  FullJitter = 'full-jitter', // 完全随机抖动 (AWS 风格)
}

export interface RetryConfig {
  maxAttempts: number; // 最大尝试次数
  baseDelay: number; // 基础延时(毫秒)
  maxDelay: number; // 最大延时(毫秒)
  strategy: RetryStrategy; // 重试策略
  jitterFactor?: number; // 抖动因子 (0.1-1.0)
}

/**
 * 计算重试延时 (包含多种策略和抖动)
 */
export function calculateDelay(attempt: number, config: RetryConfig): number {
  let delay: number;

  // 计算基础延时
  switch (config.strategy) {
    case RetryStrategy.Fixed:
      delay = config.baseDelay;
      break;

    case RetryStrategy.Exponential:
      delay = config.baseDelay * Math.pow(2, attempt - 1);
      break;

    case RetryStrategy.FullJitter: {
      // AWS 风格: 基础延时的随机值在 [0, baseDelay * 2^(attempt-1)]
      const max = config.baseDelay * Math.pow(2, attempt - 1);
      delay = Math.random() * max;
      break;
    }

    case RetryStrategy.WithJitter:
    default: {
      // 基础指数回退 + 抖动
      const base = config.baseDelay * Math.pow(2, attempt - 1);
      delay = base;
    }
  }

  // 限制最大延时
  const finalDelay = Math.min(delay, config.maxDelay);

  // 应用抖动因子 (如果配置了)
  if (config.jitterFactor && config.jitterFactor > 0 && config.jitterFactor <= 1) {
    const jitterRange = finalDelay * config.jitterFactor;
    const jitter = Math.random() * jitterRange * 2 - jitterRange; // [-range, +range]
    const adjustedDelay = finalDelay + jitter;

    // 确保延时不小于基础最小值且不超过最大延时
    return Math.max(config.baseDelay, Math.min(adjustedDelay, config.maxDelay));
  }

  return finalDelay;
}

/**
 * 执行带智能重试的操作
 */
export async function withSmartRetry<T>(
  operation: () => Promise<T> | T,
  config: RetryConfig,
  onRetry?: (attempt: number, delay: number, error: Error) => void,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error: unknown) {
      const err = asError(error);
      lastError = err ?? new Error(errMessage(error));

      // 如果是最后一次尝试，抛出错误
      if (attempt >= config.maxAttempts) {
        break;
      }

      // 计算延时
      const delay = calculateDelay(attempt, config);

      // 执行回调
      if (onRetry) {
        onRetry(attempt, delay, lastError);
      }

      // 等待后重试
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Operation failed after all retry attempts');
}

/**
 * 智能重试包装器 - 专为浏览器操作设计
 * 自动检测错误类型并应用适当的重试策略
 */
export interface BrowserRetryConfig extends RetryConfig {
  // 浏览器特定配置
  navigationTimeout?: number; // 导航超时 (ms)
  elementTimeout?: number; // 元素查找超时 (ms)
  retryOnErrors?: string[]; // 可重试的错误类型关键词
}

/**
 * 为浏览器操作创建默认重试配置
 */
export function createBrowserRetryConfig(
  overrides: Partial<BrowserRetryConfig> = {},
): BrowserRetryConfig {
  const defaultConfig: BrowserRetryConfig = {
    maxAttempts: 3,
    baseDelay: 500, // 500ms 基础延时
    maxDelay: 5000, // 最大5秒
    strategy: RetryStrategy.WithJitter,
    jitterFactor: 0.3, // 30% 抖动
    navigationTimeout: 30000,
    elementTimeout: 5000,
    retryOnErrors: ['timeout', 'network', 'element', 'selector'],
  };

  return { ...defaultConfig, ...overrides };
}

/** 别名：兼容既有调用方/测试命名 */
export const withRetry = withSmartRetry;
