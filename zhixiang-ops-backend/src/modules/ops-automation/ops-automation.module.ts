import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

import { IntelModule } from '../intel/intel.module';
import { AnalyzeModule } from '../analyze/analyze.module';
import { TopicModule } from '../topic/topic.module';
import { ScriptModule } from '../script/script.module';
import { PublishModule } from '../publish/publish.module';
import { RecycleModule } from '../recycle/recycle.module';
import { CollectTaskEntity } from '../intel/collect-task.entity';

import { OpsStrategyRegistry } from './ops-strategy.registry';
import { AutoChainService } from './auto-chain.service';
import { OpsStrategy } from './ops-automation.types';
import { OPS_STRATEGY_TOKEN } from './ops-automation.constants';
import { OpsAutomationController } from './ops-automation.controller';

import { RETRIEVE_STRATEGIES } from './strategies/retrieve.strategies';
import { SCREEN_STRATEGIES } from './strategies/screen.strategies';
import { PUBLISH_UP_STRATEGIES } from './strategies/publish-up.strategies';
import { DELIVER_STRATEGIES } from './strategies/deliver.strategies';
import { VERIFY_STRATEGIES } from './strategies/verify.strategies';

const STRATEGY_PROVIDERS = [
  ...RETRIEVE_STRATEGIES,
  ...SCREEN_STRATEGIES,
  ...PUBLISH_UP_STRATEGIES,
  ...DELIVER_STRATEGIES,
  ...VERIFY_STRATEGIES,
];

/** 将所有策略实例汇聚为一个数组 token，供注册器在 onModuleInit 统一登记 */
export { OPS_STRATEGY_TOKEN } from './ops-automation.constants';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    IntelModule,
    AnalyzeModule,
    TopicModule,
    ScriptModule,
    PublishModule,
    RecycleModule,
    TypeOrmModule.forFeature([CollectTaskEntity]),
  ],
  controllers: [OpsAutomationController],
  providers: [
    OpsStrategyRegistry,
    AutoChainService,
    ...STRATEGY_PROVIDERS,
    {
      provide: OPS_STRATEGY_TOKEN,
      useFactory: (...strategies: OpsStrategy[]) => strategies,
      inject: STRATEGY_PROVIDERS,
    },
  ],
  exports: [AutoChainService, OpsStrategyRegistry],
})
export class OpsAutomationModule {}
