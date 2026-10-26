import { Module } from '@nestjs/common';
import { HumanAdjustmentService } from './human-adjustment.service';
import { HumanAdjustmentController } from './human-adjustment.controller';
import { AuditService } from '../n/audit.service';
import { AuditLogEntity } from '../n/audit-log.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLogEntity])],
  providers: [HumanAdjustmentService, AuditService],
  controllers: [HumanAdjustmentController],
  exports: [HumanAdjustmentService],
})
export class HumanAdjustmentModule {}
