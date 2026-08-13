import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdAccountEntity, AdCampaignEntity, AdMetricEntity } from './index';
import { AdService } from './ad.service';
import { AdController } from './ad.controller';
import { NModule } from '../n/n.module';

@Module({
  imports: [
    NModule, // 操作审计 AuditService
    TypeOrmModule.forFeature([AdAccountEntity, AdCampaignEntity, AdMetricEntity]),
  ],
  controllers: [AdController],
  providers: [AdService],
  exports: [AdService],
})
export class SModule {}
