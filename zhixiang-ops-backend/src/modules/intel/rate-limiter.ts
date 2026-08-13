import { Injectable } from '@nestjs/common';
import { RedisService } from '../../cache/redis.service';

/**
 * 采集限流（令牌桶，按 租户+平台）。
 * capacity：桶容量（可放行的最大并发/窗口内请求数）
 * refillPerSec：每秒补充令牌数
 * 返回 true=放行，false=限流（调用方抛 COLLECT_RATE_LIMITED）。
 */
@Injectable()
export class CollectRateLimiter {
  constructor(private readonly redis: RedisService) {}

  async allow(
    tenantId: string,
    platform: string,
    capacity: number,
    refillPerSec: number,
  ): Promise<boolean> {
    const key = `collect:tb:${tenantId}:${platform}`;
    const raw = await this.redis.get(key);
    const now = Date.now();
    let tokens = capacity;
    let ts = now;
    if (raw) {
      const idx = raw.lastIndexOf(':');
      tokens = Number(raw.slice(0, idx));
      ts = Number(raw.slice(idx + 1));
      if (Number.isNaN(tokens) || Number.isNaN(ts)) {
        tokens = capacity;
        ts = now;
      }
    }
    const elapsed = (now - ts) / 1000;
    tokens = Math.min(capacity, tokens + elapsed * refillPerSec);
    const ttl = Math.max(1, Math.ceil(capacity / refillPerSec) + 1);
    if (tokens >= 1) {
      tokens -= 1;
      await this.redis.set(key, `${tokens}:${now}`, ttl);
      return true;
    }
    await this.redis.set(key, `${tokens}:${now}`, ttl);
    return false;
  }
}
