import { Injectable, Type } from '@nestjs/common';
import { RecycleService } from '../../recycle/recycle.service';
import {
  StrategyMeta,
  VideoChainContext,
  VideoStrategy,
  VideoStageResult,
} from '../video-automation.types';

type RecycleMetric = 'traffic' | 'interaction' | 'conversion' | 'sentiment' | 'composite';

/**
 * 数据回收验证阶段（L）5 策略：覆盖流量/互动/转化/舆情/综合多维验证回收。
 * 调用 RecycleService.createVideoRecycleTasks + collectAndScore 回流选题权重。
 */
@Injectable()
export class RecycleTrafficStrategy implements VideoStrategy {
  meta: StrategyMeta = {
    key: 'recycle_traffic',
    stage: 'recycle',
    name: '流量验证回收',
    tech: 'RecycleService.createVideoRecycleTasks(metric=traffic)',
    impl: 'rule',
    scenarios: ['hotspot', 'realtime'],
    enabledByDefault: true,
    desc: '按播放/曝光流量指标验证回收',
  };
  constructor(private readonly recycle: RecycleService) {}
  async run(ctx: VideoChainContext): Promise<VideoStageResult> {
    const metric: RecycleMetric = 'traffic';
    const tasks = await this.recycle.createVideoRecycleTasks(ctx.publishTaskIds ?? [], metric);
    for (const t of tasks) await this.recycle.collectAndScore(t.id, { metric });
    return { strategy: this.meta.key, recycleTaskIds: tasks.map((t) => t.id) };
  }
}

@Injectable()
export class RecycleInteractionStrategy implements VideoStrategy {
  meta: StrategyMeta = {
    key: 'recycle_interaction',
    stage: 'recycle',
    name: '互动验证回收',
    tech: 'RecycleService.createVideoRecycleTasks(metric=interaction)',
    impl: 'rule',
    scenarios: ['comment', 'hotspot'],
    enabledByDefault: true,
    desc: '按点赞/评论/分享互动指标验证回收',
  };
  constructor(private readonly recycle: RecycleService) {}
  async run(ctx: VideoChainContext): Promise<VideoStageResult> {
    const metric: RecycleMetric = 'interaction';
    const tasks = await this.recycle.createVideoRecycleTasks(ctx.publishTaskIds ?? [], metric);
    for (const t of tasks) await this.recycle.collectAndScore(t.id, { metric });
    return { strategy: this.meta.key, recycleTaskIds: tasks.map((t) => t.id) };
  }
}

@Injectable()
export class RecycleConversionStrategy implements VideoStrategy {
  meta: StrategyMeta = {
    key: 'recycle_conversion',
    stage: 'recycle',
    name: '转化验证回收',
    tech: 'RecycleService.createVideoRecycleTasks(metric=conversion)',
    impl: 'rule',
    scenarios: ['ecommerce', 'brand'],
    enabledByDefault: true,
    desc: '按下单/转化指标验证回收',
  };
  constructor(private readonly recycle: RecycleService) {}
  async run(ctx: VideoChainContext): Promise<VideoStageResult> {
    const metric: RecycleMetric = 'conversion';
    const tasks = await this.recycle.createVideoRecycleTasks(ctx.publishTaskIds ?? [], metric);
    for (const t of tasks) await this.recycle.collectAndScore(t.id, { metric });
    return { strategy: this.meta.key, recycleTaskIds: tasks.map((t) => t.id) };
  }
}

@Injectable()
export class RecycleSentimentStrategy implements VideoStrategy {
  meta: StrategyMeta = {
    key: 'recycle_sentiment',
    stage: 'recycle',
    name: '舆情验证回收',
    tech: 'RecycleService.createVideoRecycleTasks(metric=sentiment)',
    impl: 'rule',
    scenarios: ['comment', 'brand'],
    enabledByDefault: true,
    desc: '按正负舆情/口碑指标验证回收',
  };
  constructor(private readonly recycle: RecycleService) {}
  async run(ctx: VideoChainContext): Promise<VideoStageResult> {
    const metric: RecycleMetric = 'sentiment';
    const tasks = await this.recycle.createVideoRecycleTasks(ctx.publishTaskIds ?? [], metric);
    for (const t of tasks) await this.recycle.collectAndScore(t.id, { metric });
    return { strategy: this.meta.key, recycleTaskIds: tasks.map((t) => t.id) };
  }
}

@Injectable()
export class RecycleCompositeStrategy implements VideoStrategy {
  meta: StrategyMeta = {
    key: 'recycle_composite',
    stage: 'recycle',
    name: '综合验证回收',
    tech: 'RecycleService.createVideoRecycleTasks(metric=composite)',
    impl: 'hybrid',
    scenarios: ['hotspot', 'comment', 'ecommerce', 'knowledge'],
    enabledByDefault: true,
    desc: '按综合效率指标验证回收并回流选题权重',
  };
  constructor(private readonly recycle: RecycleService) {}
  async run(ctx: VideoChainContext): Promise<VideoStageResult> {
    const metric: RecycleMetric = 'composite';
    const tasks = await this.recycle.createVideoRecycleTasks(ctx.publishTaskIds ?? [], metric);
    for (const t of tasks) await this.recycle.collectAndScore(t.id, { metric });
    return { strategy: this.meta.key, recycleTaskIds: tasks.map((t) => t.id) };
  }
}

export const RECYCLE_STRATEGIES: Type<VideoStrategy>[] = [
  RecycleTrafficStrategy,
  RecycleInteractionStrategy,
  RecycleConversionStrategy,
  RecycleSentimentStrategy,
  RecycleCompositeStrategy,
];
