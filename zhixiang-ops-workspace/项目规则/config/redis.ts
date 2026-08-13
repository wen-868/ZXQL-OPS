/**
 * Redis 缓存服务
 * 为 dashboard、商品列表、价格阶梯等高频查询提供缓存
 * 默认 TTL: 5 分钟
 */

import { Redis } from "ioredis";
import logger from "../shared/logger";
import { env } from "./env";

let redis: Redis | null = null;

/** 获取 Redis 连接（懒加载） */
function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({
      host: env.REDIS_HOST || "127.0.0.1",
      port: env.REDIS_PORT || 6379,
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    redis.on("error", (err: Error) => {
      logger.error("[Redis] Connection error:", err.message);
    });

    redis.on("connect", () => {
      logger.info("[Redis] Connected");
    });
  }

  return redis;
}

/** 默认 TTL：5 分钟 */
const DEFAULT_TTL = 300;

/**
 * 从缓存获取数据，未命中则执行查询并写入缓存
 */
export async function cacheGet<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = DEFAULT_TTL
): Promise<T> {
  try {
    const r = getRedis();
    const cached = await r.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }

    const data = await fetcher();
    await r.setex(key, ttl, JSON.stringify(data));
    return data;
  } catch (err) {
    logger.error(`[Redis] cacheGet failed for key ${key}:`, err instanceof Error ? err.message : err);
    // 降级：直接查询数据库
    return fetcher();
  }
}

/**
 * 删除缓存
 */
export async function cacheDel(key: string): Promise<void> {
  try {
    const r = getRedis();
    await r.del(key);
  } catch (err) {
    logger.error(`[Redis] cacheDel failed for key ${key}:`, err instanceof Error ? err.message : err);
  }
}

/**
 * 按模式删除缓存
 */
export async function cacheDelPattern(pattern: string): Promise<void> {
  try {
    const r = getRedis();
    const keys = await r.keys(pattern);
    if (keys.length > 0) {
      await r.del(...keys);
      logger.info(`[Redis] Deleted ${keys.length} keys matching: ${pattern}`);
    }
  } catch (err) {
    logger.error(`[Redis] cacheDelPattern failed for ${pattern}:`, err instanceof Error ? err.message : err);
  }
}

/**
 * 清除指定租户的缓存
 */
export async function invalidateTenantCache(tenantId: number): Promise<void> {
  await cacheDelPattern(`tenant:${tenantId}:*`);
}

/**
 * 缓存键生成工具
 */
export const CacheKeys = {
  /** Dashboard 统计 */
  dashboard: (tenantId: number) => `tenant:${tenantId}:dashboard`,
  /** 商品列表 */
  products: (tenantId: number, page: number, pageSize: number) => `tenant:${tenantId}:products:${page}:${pageSize}`,
  /** 单个商品 */
  product: (tenantId: number, productId: number) => `tenant:${tenantId}:product:${productId}`,
  /** 价格阶梯 */
  priceTiers: (tenantId: number, productId: number) => `tenant:${tenantId}:price_tiers:${productId}`,
  /** 客户列表 */
  customers: (tenantId: number, page: number, pageSize: number) => `tenant:${tenantId}:customers:${page}:${pageSize}`,
  /** 信用评分 */
  creditScore: (tenantId: number, customerId: number) => `tenant:${tenantId}:credit_score:${customerId}`,
};