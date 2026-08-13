import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardService } from './m.service';
import { DashboardController } from './m.controller';
import { DashboardEntity } from './dashboard.entity';
import { RecycleModule } from '../recycle/recycle.module';

// 跨域聚合所需实体（仅查询，tenantId 强隔离；与各自模块 forFeature 共享同一 DataSource）
import { TopicEntity } from '../topic/topic.entity';
import { ScriptEntity } from '../script/script.entity';
import { PublishTaskEntity } from '../publish/publish.entity';
import { FeedbackEntity, DriverEfficiencyEntity } from '../recycle/recycle.entity';
import { AccountEntity } from '../account/account.entity';
import { RevenueRecordEntity } from '../w/revenue.entity';
import { AdCampaignEntity } from '../s/ad-campaign.entity';
import { AdMetricEntity } from '../s/ad-metric.entity';
import { OrderEntity } from '../y/order.entity';

/**
 * 决策仪表盘与 BI 模块（规划 §4-M / 开发顺序 M 仪表盘与 BI）。
 * 统一 BI 聚合层：复用 RecycleModule(RecycleService) 的五维四率与 7×6 人性效能，
 * 并跨域轻量聚合漏斗/账号对比/选题效能。注册 M 实体与各域实体 Repository。
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      DashboardEntity,
      TopicEntity,
      ScriptEntity,
      PublishTaskEntity,
      FeedbackEntity,
      DriverEfficiencyEntity,
      AccountEntity,
      RevenueRecordEntity,
      AdCampaignEntity,
      AdMetricEntity,
      OrderEntity,
    ]),
    RecycleModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class MModule {}
