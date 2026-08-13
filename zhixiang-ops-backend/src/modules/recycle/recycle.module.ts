import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecycleService } from './recycle.service';
import { RecycleController } from './recycle.controller';
import { FeedbackEntity, RecycleTaskEntity, DriverEfficiencyEntity } from './recycle.entity';
import { PublishTaskEntity } from '../publish/publish.entity';
import { ScriptEntity } from '../script/script.entity';
import { TopicEntity } from '../topic/topic.entity';
import { AnalyzeModule } from '../analyze/analyze.module';
import { TopicModule } from '../topic/topic.module';

/**
 * 数据监控与回收模块（规划 §4-J / 开发顺序第8步）。
 * 注册 J 三实体，并只读消费 I 发布数据（publish/script/topic 实体）；
 * 经 AnalyzeModule / TopicModule 实现回流再分析与人性效能反哺 E 权重。
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      FeedbackEntity,
      RecycleTaskEntity,
      DriverEfficiencyEntity,
      PublishTaskEntity,
      ScriptEntity,
      TopicEntity,
    ]),
    AnalyzeModule,
    TopicModule,
  ],
  controllers: [RecycleController],
  providers: [RecycleService],
  exports: [RecycleService],
})
export class RecycleModule {}
