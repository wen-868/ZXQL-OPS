import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TopicService } from './topic.service';
import { TopicController } from './topic.controller';
import { TopicEntity } from './topic.entity';
import { HumanInsightEntity } from '../analyze/human-insight.entity';
import { AnalysisTaskEntity } from '../analyze/analysis-task.entity';
import { AccountEntity } from '../account/account.entity';

/**
 * 选题引擎模块（规划 §4-E / 开发顺序设计.md 第4步）。
 * 消费 D 的洞察库（HumanInsightEntity）与分析任务（AnalysisTaskEntity），
 * 排期校验复用 B 的账号实体（AccountEntity）。
 * 导出 TopicService 供 F 脚本 / I 发布 等下游消费。
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([TopicEntity, HumanInsightEntity, AnalysisTaskEntity, AccountEntity]),
  ],
  controllers: [TopicController],
  providers: [TopicService],
  exports: [TopicService],
})
export class TopicModule {}
