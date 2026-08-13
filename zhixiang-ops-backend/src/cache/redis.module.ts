import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

/**
 * Redis 模块（全局单例）。导出 RedisService 供任意业务模块注入。
 */
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
