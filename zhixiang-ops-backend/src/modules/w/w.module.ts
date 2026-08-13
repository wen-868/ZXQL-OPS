import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RevenueRecordEntity, ReconciliationEntity, SettlementEntity } from './index';
import { AdMetricEntity } from '../../modules/s/ad-metric.entity';
import { RevenueService } from './w.service';
import { RevenueController } from './w.controller';
import { NModule } from '../n/n.module';

@Module({
  imports: [
    NModule, // 操作审计 AuditService
    TypeOrmModule.forFeature([
      RevenueRecordEntity,
      ReconciliationEntity,
      SettlementEntity,
      AdMetricEntity, // 跨模块复用 S 投流指标（profit 计算消耗）
    ]),
  ],
  controllers: [RevenueController],
  providers: [RevenueService],
  exports: [RevenueService],
})
export class WModule {}
