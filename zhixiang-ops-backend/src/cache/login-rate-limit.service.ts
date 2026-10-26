import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';
import { AppError } from '../shared/app-error';

/**
 * 登录防爆破限流（商业级清单 C1）。
 * - Redis 可用：incr + expire 原子计数（key=ops:login:fail:<ip>:<username>），
 *   连续失败达 LOGIN_MAX_FAILS 进入锁定窗口（TTL=LOGIN_LOCK_MS），窗口内返回 429 TOO_MANY_REQUESTS。
 * - Redis 不可用：降级为进程内 Map 兜底（单实例有效，不中断服务）。
 */
export const LOGIN_MAX_FAILS = 5;
export const LOGIN_LOCK_MS = 5 * 60 * 1000;
const KEY_PREFIX = 'ops:login:fail:';
const LOCK_TTL_SEC = LOGIN_LOCK_MS / 1000;

interface InMemoryEntry {
  fails: number;
  lockedUntil: number;
}

@Injectable()
export class LoginRateLimitService {
  /** 进程内兜底表（惰性过期清理，不引入定时器） */
  private readonly memory = new Map<string, InMemoryEntry>();

  constructor(private readonly redis: RedisService) {}

  /** 限流键：IP 与用户名双维度，防针对单 IP/单账号爆破 */
  static key(ip: string, username: string): string {
    return `${KEY_PREFIX}${ip}:${username}`;
  }

  /** 命中锁定窗口抛出 429（TOO_MANY_REQUESTS） */
  async assertAllowed(key: string): Promise<void> {
    try {
      const raw = await this.redis.get(key);
      const lock = this.parseLock(raw);
      if (lock && lock.lockedUntil > Date.now()) {
        throw new AppError(
          'TOO_MANY_REQUESTS',
          `登录失败次数过多，请 ${Math.ceil((lock.lockedUntil - Date.now()) / 1000)} 秒后重试`,
        );
      }
      return;
    } catch (e) {
      if (e instanceof AppError) throw e;
      // Redis 不可用（读失败）→ 内存兜底
    }

    const entry = this.memory.get(key);
    if (!entry || entry.lockedUntil === 0) return;
    if (entry.lockedUntil > Date.now()) {
      throw new AppError(
        'TOO_MANY_REQUESTS',
        `登录失败次数过多，请 ${Math.ceil((entry.lockedUntil - Date.now()) / 1000)} 秒后重试`,
      );
    }
    // 锁定窗口已过：惰性清理
    this.memory.delete(key);
  }

  /** 记录一次失败；达到阈值进入锁定窗口 */
  async recordFailure(key: string): Promise<void> {
    try {
      const count = await this.redis.incr(key);
      if (count === 1) await this.redis.expire(key, LOCK_TTL_SEC);
      if (count >= LOGIN_MAX_FAILS) {
        // 进入锁定窗口：覆盖为锁定状态 JSON，TTL 维持 5 分钟窗口（锁定期内继续失败自动顺延）
        await this.redis.setJson(key, { lockedUntil: Date.now() + LOGIN_LOCK_MS }, LOCK_TTL_SEC);
      }
      return;
    } catch {
      // Redis 不可用（写失败）→ 内存兜底
    }

    const now = Date.now();
    const entry = this.memory.get(key) ?? { fails: 0, lockedUntil: 0 };
    if (entry.lockedUntil > now) {
      // 锁定期间继续失败：延长锁定窗口
      entry.lockedUntil = now + LOGIN_LOCK_MS;
      entry.fails = 0;
    } else {
      entry.fails += 1;
      if (entry.fails >= LOGIN_MAX_FAILS) {
        entry.fails = 0;
        entry.lockedUntil = now + LOGIN_LOCK_MS;
      }
    }
    this.memory.set(key, entry);
  }

  /** 登录成功后清零 */
  async reset(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch {
      // Redis 不可用 → 内存兜底
    }
    this.memory.delete(key);
  }

  /** 计数阶段存的是纯数字（incr 结果），锁定阶段存 {lockedUntil} JSON；非锁定值返回 null */
  private parseLock(raw: string | null): { lockedUntil: number } | null {
    if (!raw) return null;
    try {
      const obj = JSON.parse(raw) as { lockedUntil?: number };
      return typeof obj?.lockedUntil === 'number' ? (obj as { lockedUntil: number }) : null;
    } catch {
      return null;
    }
  }
}
