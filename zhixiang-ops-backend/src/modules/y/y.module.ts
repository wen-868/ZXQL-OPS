import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderEntity, LogisticsTrackEntity, WaybillEntity } from './index';
import { OrderService } from './y.service';
import { OrderController } from './y.controller';
import { RModule } from '../r/r.module';
import { IntegrationModule } from '../../integration/integration.module';
import { NModule } from '../n/n.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([OrderEntity, LogisticsTrackEntity, WaybillEntity]),
    RModule, // 复用 ProductService（库存单一真源 updateStock）
    IntegrationModule, // 双源接入桩（平台订单/面单/快递 API）
    NModule, // 操作审计 AuditService
  ],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class YModule {}
