import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationService } from './integration.service';
import { CallbackController } from './callback.controller';
import { IntegrationCfg } from './integration-cfg.entity';
import { TenantBind } from './tenant-bind.entity';
import { IntegrationController } from './integration.controller';

/**
 * 适配层模块（规划 §7 / §17）。
 * 导出 IntegrationService 供业务模块（I/K/U/Y/W/R/T）注入，透明获取适配器。
 */
@Module({
  imports: [TypeOrmModule.forFeature([IntegrationCfg, TenantBind])],
  controllers: [CallbackController, IntegrationController],
  providers: [IntegrationService],
  exports: [IntegrationService],
})
export class IntegrationModule {}
