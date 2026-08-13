import { Injectable, Type } from '@nestjs/common';
import { TopicService } from '../../topic/topic.service';
import {
  StrategyMeta,
  VideoChainContext,
  VideoStrategy,
  VideoStageResult,
} from '../video-automation.types';

interface TopicCfg {
  driver?: string;
  emotion?: string;
}

/**
 * 选题阶段（E）5 策略：覆盖好奇/共鸣/贪/窥探/综合多人性情绪维度。
 * 消费分析阶段(analysisId)洞察；无人性分析时回退知识库聚合（纯洞察，不依赖 LLM）。
 */
@Injectable()
export class TopicHeatStrategy implements VideoStrategy {
  meta: StrategyMeta = {
    key: 'topic_heat',
    stage: 'topic',
    name: '好奇驱动选题',
    tech: 'TopicService.generateTopics(driver=好奇)',
    impl: 'rule',
    scenarios: ['hotspot', 'knowledge'],
    enabledByDefault: true,
    desc: '以「好奇」人性驱动生成钩子型选题',
  };
  constructor(private readonly topic: TopicService) {}
  async run(ctx: VideoChainContext): Promise<VideoStageResult> {
    const cfg: TopicCfg = { emotion: '好奇' };
    const analysisId = ctx.analysisTaskIds?.[0];
    const { topics } = await this.topic.generateTopics({
      emotion: cfg.emotion,
      limit: 5,
      ...(analysisId ? { analysisId } : {}),
    });
    return { strategy: this.meta.key, topicIds: topics.map((t) => t.id) };
  }
}

@Injectable()
export class TopicEmotionStrategy implements VideoStrategy {
  meta: StrategyMeta = {
    key: 'topic_emotion',
    stage: 'topic',
    name: '共鸣情绪选题',
    tech: 'TopicService.generateTopics(emotion=共鸣)',
    impl: 'rule',
    scenarios: ['comment', 'ecommerce'],
    enabledByDefault: true,
    desc: '以「共鸣」情绪生成共情型选题',
  };
  constructor(private readonly topic: TopicService) {}
  async run(ctx: VideoChainContext): Promise<VideoStageResult> {
    const cfg: TopicCfg = { emotion: '共鸣' };
    const analysisId = ctx.analysisTaskIds?.[0];
    const { topics } = await this.topic.generateTopics({
      emotion: cfg.emotion,
      limit: 5,
      ...(analysisId ? { analysisId } : {}),
    });
    return { strategy: this.meta.key, topicIds: topics.map((t) => t.id) };
  }
}

@Injectable()
export class TopicConversionStrategy implements VideoStrategy {
  meta: StrategyMeta = {
    key: 'topic_conversion',
    stage: 'topic',
    name: '贪欲转化选题',
    tech: 'TopicService.generateTopics(driver=贪)',
    impl: 'rule',
    scenarios: ['ecommerce', 'brand'],
    enabledByDefault: true,
    desc: '以「贪/占便宜」人性驱动生成带货转化型选题',
  };
  constructor(private readonly topic: TopicService) {}
  async run(ctx: VideoChainContext): Promise<VideoStageResult> {
    const cfg: TopicCfg = { driver: '贪' };
    const analysisId = ctx.analysisTaskIds?.[0];
    const { topics } = await this.topic.generateTopics({
      driver: cfg.driver,
      limit: 5,
      ...(analysisId ? { analysisId } : {}),
    });
    return { strategy: this.meta.key, topicIds: topics.map((t) => t.id) };
  }
}

@Injectable()
export class TopicNoveltyStrategy implements VideoStrategy {
  meta: StrategyMeta = {
    key: 'topic_novelty',
    stage: 'topic',
    name: '窥探猎奇选题',
    tech: 'TopicService.generateTopics(driver=窥探)',
    impl: 'rule',
    scenarios: ['hotspot', 'realtime'],
    enabledByDefault: true,
    desc: '以「窥探/猎奇」人性驱动生成悬念型选题',
  };
  constructor(private readonly topic: TopicService) {}
  async run(ctx: VideoChainContext): Promise<VideoStageResult> {
    const cfg: TopicCfg = { driver: '窥探' };
    const analysisId = ctx.analysisTaskIds?.[0];
    const { topics } = await this.topic.generateTopics({
      driver: cfg.driver,
      limit: 5,
      ...(analysisId ? { analysisId } : {}),
    });
    return { strategy: this.meta.key, topicIds: topics.map((t) => t.id) };
  }
}

@Injectable()
export class TopicCompositeStrategy implements VideoStrategy {
  meta: StrategyMeta = {
    key: 'topic_composite',
    stage: 'topic',
    name: '综合洞察选题',
    tech: 'TopicService.generateTopics(无驱动,全量聚合)',
    impl: 'hybrid',
    scenarios: ['hotspot', 'comment', 'ecommerce', 'knowledge'],
    enabledByDefault: true,
    desc: '不限定驱动，综合全部人性洞察聚合生成候选选题',
  };
  constructor(private readonly topic: TopicService) {}
  async run(ctx: VideoChainContext): Promise<VideoStageResult> {
    const analysisId = ctx.analysisTaskIds?.[0];
    const { topics } = await this.topic.generateTopics({
      limit: 8,
      ...(analysisId ? { analysisId } : {}),
    });
    return { strategy: this.meta.key, topicIds: topics.map((t) => t.id) };
  }
}

export const TOPIC_STRATEGIES: Type<VideoStrategy>[] = [
  TopicHeatStrategy,
  TopicEmotionStrategy,
  TopicConversionStrategy,
  TopicNoveltyStrategy,
  TopicCompositeStrategy,
];
