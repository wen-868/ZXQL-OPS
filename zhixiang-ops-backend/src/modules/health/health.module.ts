import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/** 健康检查模块：演示统一信封 + 租户上下文读取。 */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
