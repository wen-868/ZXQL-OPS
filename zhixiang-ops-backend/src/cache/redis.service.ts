import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from '../shared/logger';

/**
 * Redis 服务（运营系统缓存 / 队列 / 限流地基）。
 * 复用管理系统的 REDIS_* 配置。O 能力网关降级、采集去重、回收限速等后续模块共用。
 * 仅包装常用方法，原始 client 也可直接取用。
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor() {
    this.client = new Redis(env.REDIS_URL, {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      lazyConnect: false,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 200, 3000),
    });
    this.client.on('error', (e) => logger.error({ err: e.message }, 'redis 连接错误'));
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds && ttlSeconds > 0) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  /** 存 JSON（自动序列化） */
  async setJson(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  /** 取 JSON（自动反序列化，失败返回 null） */
  async getJson<T = unknown>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async del(key: string): Promise<number> {
    return this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1;
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.client.expire(key, ttlSeconds);
  }

  /** 原子自增，常用于限流计数 */
  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }
}
