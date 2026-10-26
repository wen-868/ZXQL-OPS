import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { LoginRateLimitService } from './login-rate-limit.service';

/**
 * Redis 模块（全局单例）。导出 RedisService 与基于 Redis 的登录限流服务，供任意业务模块注入。
 */
@Global()
@Module({
  providers: [RedisService, LoginRateLimitService],
  exports: [RedisService, LoginRateLimitService],
})
export class RedisModule {}
