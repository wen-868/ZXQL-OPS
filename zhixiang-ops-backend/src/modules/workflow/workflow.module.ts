import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowService } from './workflow.service';
import { WorkflowController } from './workflow.controller';
import { WorkflowDefEntity, WorkflowRunEntity, WorkflowRunLogEntity } from './workflow.entity';
import { IntelModule } from '../intel/intel.module';
import { AnalyzeModule } from '../analyze/analyze.module';
import { TopicModule } from '../topic/topic.module';
import { ScriptModule } from '../script/script.module';
import { GModule } from '../g/g.module';
import { HModule } from '../h/h.module';
import { PublishModule } from '../publish/publish.module';

/**
 * 工作流编排模块（规划 §4-L）。
 * 注入 C/D/E/F/G/H/I 各模块服务以串联全链路闭环（这些模块均导出其 Service）。
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([WorkflowDefEntity, WorkflowRunEntity, WorkflowRunLogEntity]),
    IntelModule,
    AnalyzeModule,
    TopicModule,
    ScriptModule,
    GModule,
    HModule,
    PublishModule,
  ],
  controllers: [WorkflowController],
  providers: [WorkflowService],
  exports: [WorkflowService],
})
export class WorkflowModule {}
