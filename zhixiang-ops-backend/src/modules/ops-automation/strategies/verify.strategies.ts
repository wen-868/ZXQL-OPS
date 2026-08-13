import { Injectable } from '@nestjs/common';
import { RecycleService } from '../../recycle/recycle.service';
import { OpsChainContext, OpsStrategy, VerifyResult } from '../ops-automation.types';

/**
 * 验证阶段 5 种实现方案（J 回收回流，补全阶段1 占位）。
 * 统一入口 RecycleService（视频维度回收任务 → 度量评分 → 人性效能反哺 E）。
 * - traffic：播放/完播度量（rule，realtime）
 * - interaction：互动率度量（rule，品牌）
 * - conversion：转化漏斗度量（api，电商）
 * - sentiment：评论情感度量（llm，舆情）
 * - composite：综合效能度量（hybrid，通用默认）
 */

@Injectable()
export class VerifyTrafficStrategy implements OpsStrategy {
  meta = {
    key: 'verify_traffic',
    stage: 'verify' as const,
    name: '流量度量验证',
    tech: 'Rule(play/complete) + RecycleService',
    impl: 'rule' as const,
    scenarios: ['realtime', 'hotspot'],
    enabledByDefault: true,
    desc: '按播放量与完播率回收度量，适合热点内容实时验证。',
  };
  constructor(private readonly recycleService: RecycleService) {}
  async run(ctx: OpsChainContext): Promise<VerifyResult> {
    const tasks = await this.recycleService.createVideoRecycleTasks(
      ctx.publishTaskIds ?? [],
      'traffic',
    );
    for (const t of tasks) {
      await this.recycleService.collectAndScore(t.id, { metric: 'traffic' });
    }
    return {
      recycleTaskIds: tasks.map((t) => t.id),
      ratedTopics: tasks.length,
      feedbacks: tasks.length,
      strategy: this.meta.key,
    };
  }
}

@Injectable()
export class VerifyInteractionStrategy implements OpsStrategy {
  meta = {
    key: 'verify_interaction',
    stage: 'verify' as const,
    name: '互动率验证',
    tech: 'Rule(interact) + RecycleService',
    impl: 'rule' as const,
    scenarios: ['brand'],
    enabledByDefault: true,
    desc: '按点赞/评论/转发互动率回收度量，适合品牌种草。',
  };
  constructor(private readonly recycleService: RecycleService) {}
  async run(ctx: OpsChainContext): Promise<VerifyResult> {
    const tasks = await this.recycleService.createVideoRecycleTasks(
      ctx.publishTaskIds ?? [],
      'interaction',
    );
    for (const t of tasks) {
      await this.recycleService.collectAndScore(t.id, { metric: 'interaction' });
    }
    return {
      recycleTaskIds: tasks.map((t) => t.id),
      ratedTopics: tasks.length,
      feedbacks: tasks.length,
      strategy: this.meta.key,
    };
  }
}

@Injectable()
export class VerifyConversionStrategy implements OpsStrategy {
  meta = {
    key: 'verify_conversion',
    stage: 'verify' as const,
    name: '转化漏斗验证',
    tech: 'API(order funnel) + RecycleService',
    impl: 'api' as const,
    scenarios: ['ecommerce', 'local-life'],
    enabledByDefault: true,
    desc: '按挂车点击/下单转化回收度量，适合电商带货。',
  };
  constructor(private readonly recycleService: RecycleService) {}
  async run(ctx: OpsChainContext): Promise<VerifyResult> {
    const tasks = await this.recycleService.createVideoRecycleTasks(
      ctx.publishTaskIds ?? [],
      'conversion',
    );
    for (const t of tasks) {
      await this.recycleService.collectAndScore(t.id, { metric: 'conversion' });
    }
    return {
      recycleTaskIds: tasks.map((t) => t.id),
      ratedTopics: tasks.length,
      feedbacks: tasks.length,
      strategy: this.meta.key,
    };
  }
}

@Injectable()
export class VerifySentimentStrategy implements OpsStrategy {
  meta = {
    key: 'verify_sentiment',
    stage: 'verify' as const,
    name: '评论情感验证',
    tech: 'LLM(sentiment) + RecycleService',
    impl: 'llm' as const,
    scenarios: ['brand', 'hotspot'],
    enabledByDefault: true,
    desc: '对回收评论做情感分析验证，适合舆情与品牌监测。',
  };
  constructor(private readonly recycleService: RecycleService) {}
  async run(ctx: OpsChainContext): Promise<VerifyResult> {
    const tasks = await this.recycleService.createVideoRecycleTasks(
      ctx.publishTaskIds ?? [],
      'sentiment',
    );
    for (const t of tasks) {
      await this.recycleService.collectAndScore(t.id, { metric: 'sentiment' });
    }
    return {
      recycleTaskIds: tasks.map((t) => t.id),
      ratedTopics: tasks.length,
      feedbacks: tasks.length,
      strategy: this.meta.key,
    };
  }
}

@Injectable()
export class VerifyCompositeStrategy implements OpsStrategy {
  meta = {
    key: 'verify_composite',
    stage: 'verify' as const,
    name: '综合效能验证',
    tech: 'Hybrid(traffic+interaction+conversion) + RecycleService',
    impl: 'hybrid' as const,
    scenarios: ['hotspot', 'brand', 'ecommerce', 'knowledge'],
    enabledByDefault: true,
    desc: '多维加权综合效能回收，反哺 E 选题权重，通用默认验证策略。',
  };
  constructor(private readonly recycleService: RecycleService) {}
  async run(ctx: OpsChainContext): Promise<VerifyResult> {
    const tasks = await this.recycleService.createVideoRecycleTasks(
      ctx.publishTaskIds ?? [],
      'composite',
    );
    for (const t of tasks) {
      await this.recycleService.collectAndScore(t.id, { metric: 'composite' });
    }
    return {
      recycleTaskIds: tasks.map((t) => t.id),
      ratedTopics: tasks.length,
      feedbacks: tasks.length,
      strategy: this.meta.key,
    };
  }
}

export const VERIFY_STRATEGIES = [
  VerifyTrafficStrategy,
  VerifyInteractionStrategy,
  VerifyConversionStrategy,
  VerifySentimentStrategy,
  VerifyCompositeStrategy,
];
