import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComplianceService } from './compliance.service';
import { ComplianceController } from './compliance.controller';
import { ComplianceWordEntity } from './compliance-word.entity';
import { ComplianceLogEntity } from './compliance-log.entity';

/**
 * 合规预检模块（规划 §4-P / 合规风控核心域）。
 * exports ComplianceService，供 F 脚本 / H 成片 / I 发布 / K 直播 / AA 客服 注入调用统一预检。
 */
@Module({
  imports: [TypeOrmModule.forFeature([ComplianceWordEntity, ComplianceLogEntity])],
  controllers: [ComplianceController],
  providers: [ComplianceService],
  exports: [ComplianceService],
})
export class ComplianceModule {}
