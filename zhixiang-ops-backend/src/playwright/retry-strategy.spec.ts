/**
 * 单元测试规格 - RetryStrategy
 *
 * 测试各种重试策略的延时计算和重试执行功能
 */

import { withRetry, RetryStrategy, RetryConfig, calculateDelay } from './retry-strategy';

describe('RetryStrategy', () => {
  describe('calculateDelay', () => {
    test('固定间隔策略', () => {
      const config: RetryConfig = {
        maxAttempts: 3,
        baseDelay: 100,
        maxDelay: 1000,
        strategy: RetryStrategy.Fixed,
      };
      const delay = calculateDelay(1, config);
      expect(delay).toBe(100);
    });

    test('指数回退策略', () => {
      const config: RetryConfig = {
        maxAttempts: 5,
        baseDelay: 50,
        maxDelay: 5000,
        strategy: RetryStrategy.Exponential,
      };
      const delay1 = calculateDelay(1, config); // 50 * 2^0 = 50
      const delay3 = calculateDelay(3, config); // 50 * 2^2 = 200
      expect(delay1).toBe(50);
      expect(delay3).toBe(200);
    });

    test('带抖动策略', () => {
      const config: RetryConfig = {
        maxAttempts: 3,
        baseDelay: 100,
        maxDelay: 1000,
        strategy: RetryStrategy.WithJitter,
      };
      const delay = calculateDelay(1, config);
      // 应该在 75-125 之间 (100 +/- 25%)
      expect(delay).toBeGreaterThanOrEqual(75);
      expect(delay).toBeLessThanOrEqual(125);
    });
  });

  describe('withRetry', () => {
    test('成功的操作不应重试', async () => {
      let attempts = 0;
      const result = await withRetry(
        () => {
          attempts++;
          return 'success';
        },
        {
          maxAttempts: 3,
          baseDelay: 50,
          maxDelay: 1000,
          strategy: RetryStrategy.Fixed,
        },
      );
      expect(result).toBe('success');
      expect(attempts).toBe(1); // 不应重试
    });

    test('失败后应重试最终失败', async () => {
      let attempts = 0;
      await expect(
        withRetry(
          () => {
            attempts++;
            return Promise.reject(new Error('Always fails'));
          },
          {
            maxAttempts: 3,
            baseDelay: 10,
            maxDelay: 100,
            strategy: RetryStrategy.Fixed,
          },
        ),
      ).rejects.toThrow('Always fails');
      expect(attempts).toBe(3); // 应该尝试 3 次
    });

    test('带指数回退的重试', async () => {
      let attempts = 0;
      const baseDelay = 10;

      await expect(
        withRetry(
          () => {
            attempts++;
            if (attempts < 3) {
              return Promise.reject(new Error('Transient error'));
            }
            return 'success';
          },
          {
            maxAttempts: 5,
            baseDelay: baseDelay,
            maxDelay: 1000,
            strategy: RetryStrategy.Exponential,
          },
        ),
      ).resolves.toBe('success');

      // 应该尝试了多次直到成功
      expect(attempts).toBeGreaterThanOrEqual(3);
    });
  });
});
