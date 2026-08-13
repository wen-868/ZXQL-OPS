import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { IntelModule } from '../intel/intel.module';
import { AnalyzeModule } from '../analyze/analyze.module';
import { TopicModule } from '../topic/topic.module';
import { ScriptModule } from '../script/script.module';
import { GModule } from '../g/g.module';
import { HModule } from '../h/h.module';
import { PublishModule } from '../publish/publish.module';
import { RecycleModule } from '../recycle/recycle.module';

import { VideoStrategyRegistry } from './video-strategy.registry';
import { VideoAutoChainService } from './auto-chain.service';
import { VideoStrategy } from './video-automation.types';
import { VIDEO_STRATEGY_TOKEN } from './video-automation.constants';
import { VideoAutomationController } from './video-automation.controller';

import { INTEL_STRATEGIES } from './strategies/intel.strategies';
import { ANALYZE_STRATEGIES } from './strategies/analyze.strategies';
import { TOPIC_STRATEGIES } from './strategies/topic.strategies';
import { SCRIPT_STRATEGIES } from './strategies/script.strategies';
import { MATERIAL_STRATEGIES } from './strategies/material.strategies';
import { COMPOSE_STRATEGIES } from './strategies/compose.strategies';
import { PUBLISH_STRATEGIES } from './strategies/publish.strategies';
import { RECYCLE_STRATEGIES } from './strategies/recycle.strategies';

const STRATEGY_PROVIDERS = [
  ...INTEL_STRATEGIES,
  ...ANALYZE_STRATEGIES,
  ...TOPIC_STRATEGIES,
  ...SCRIPT_STRATEGIES,
  ...MATERIAL_STRATEGIES,
  ...COMPOSE_STRATEGIES,
  ...PUBLISH_STRATEGIES,
  ...RECYCLE_STRATEGIES,
];

/** 将所有策略实例汇聚为一个数组 token，供注册器在 onModuleInit 统一登记 */
export { VIDEO_STRATEGY_TOKEN } from './video-automation.constants';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    IntelModule,
    AnalyzeModule,
    TopicModule,
    ScriptModule,
    GModule,
    HModule,
    PublishModule,
    RecycleModule,
  ],
  controllers: [VideoAutomationController],
  providers: [
    VideoStrategyRegistry,
    VideoAutoChainService,
    ...STRATEGY_PROVIDERS,
    {
      provide: VIDEO_STRATEGY_TOKEN,
      useFactory: (...strategies: VideoStrategy[]) => strategies,
      inject: STRATEGY_PROVIDERS,
    },
  ],
  exports: [VideoAutoChainService, VideoStrategyRegistry],
})
export class VideoAutomationModule {}
