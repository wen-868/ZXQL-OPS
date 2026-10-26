/**
 * 单元测试规格 - CircuitBreaker
 *
 * 测试熔断器的状态转换、计时器和统计功能
 */

import { CircuitBreaker, CircuitBreakerState } from './circuit-breaker';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 1000,
      halfOpenMaxCalls: 1,
    });
  });

  describe('状态转换', () => {
    test('应初始为闭合状态', () => {
      expect(breaker.getState()).toBe(CircuitBreakerState.Closed);
    });

    test('失败次数达到阈值后应打开', async () => {
      // 模拟 3 次失败
      breaker.recordResult(false);
      breaker.recordResult(false);
      breaker.recordResult(false);

      expect(breaker.getState()).toBe(CircuitBreakerState.Open);
    });

    test('打开状态后应在超时后转为半开', async () => {
      breaker.recordResult(false);
      breaker.recordResult(false);
      breaker.recordResult(false);

      // 等待重置超时
      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(breaker.getState()).toBe(CircuitBreakerState.HalfOpen);
    });
  });

  describe('成功恢复', () => {
    test('成功调用应重置失败计数', () => {
      breaker.recordResult(false);
      breaker.recordResult(false);
      breaker.recordResult(false);
      breaker.recordResult(true);

      expect(breaker.getState()).toBe(CircuitBreakerState.Closed);
    });
  });

  describe('操作执行', () => {
    test('闭合状态下的操作应成功', async () => {
      const result = await breaker.execute(() => Promise.resolve('success'));
      expect(result).toBe('success');
      expect(breaker.getState()).toBe(CircuitBreakerState.Closed);
    });

    test('打开状态下的操作应被拒绝', async () => {
      // 首先打开熔断器
      breaker.recordResult(false);
      breaker.recordResult(false);
      breaker.recordResult(false);

      await expect(breaker.execute(() => Promise.resolve('success'))).rejects.toThrow(
        'Circuit breaker is open',
      );
    });
  });

  describe('统计信息', () => {
    test('应提供统计信息', () => {
      const stats = breaker.getStats();
      expect(stats).toHaveProperty('state');
      expect(stats).toHaveProperty('failureCount');
      expect(stats).toHaveProperty('successCount');
    });
  });
});
