import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyzeService } from './analyze.service';
import { AnalyzeController } from './analyze.controller';
import { AnalysisTaskEntity } from './analysis-task.entity';
import { HumanInsightEntity } from './human-insight.entity';
import { CollectedCommentEntity } from '../intel/collected-comment.entity';

/**
 * 人性分析与洞察引擎模块（规划 §4-D）。
 * 注册 2 张实体（分析任务 / 洞察知识库）+ 消费 C 的采集评论实体（跨模块 forFeature 同一 entity 允许）。
 * 导出 AnalyzeService 供 E 选题等下游消费。
 * SkillGateway 为 @Global，直接注入，无需 import SkillModule。
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([AnalysisTaskEntity, HumanInsightEntity, CollectedCommentEntity]),
  ],
  controllers: [AnalyzeController],
  providers: [AnalyzeService],
  exports: [AnalyzeService],
})
export class AnalyzeModule {}
