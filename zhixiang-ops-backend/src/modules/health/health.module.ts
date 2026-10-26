import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthChecker } from './health-checker';
import { BrowserModule } from '../browser/browser.module';

/** 健康检查模块：演示统一信封 + 租户上下文读取 + 深度依赖探测。 */
@Module({
  imports: [BrowserModule],
  controllers: [HealthController],
  providers: [HealthChecker],
  exports: [HealthChecker],
})
export class HealthModule {}
