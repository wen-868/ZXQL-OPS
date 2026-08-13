import { Injectable } from '@nestjs/common';
import { TopicService } from '../../topic/topic.service';
import { OpsChainContext, OpsStrategy, ScreenResult } from '../ops-automation.types';

/**
 * 筛选阶段 5 种实现方案：统一入口 TopicService.generateTopics（消费 D 洞察），
 * 通过不同人性驱动/情绪权重实现"多实现路径"覆盖。
 * - heat：好奇驱动优先（rule，热点追踪）
 * - emotion：共鸣情绪优先（hybrid，品牌种草）
 * - conversion：贪驱动优先（rule，电商带货）
 * - novelty：窥探驱动优先（llm，知识科普）
 * - composite：综合加权（hybrid，通用默认）
 */

@Injectable()
export class ScreenHeatStrategy implements OpsStrategy {
  meta = {
    key: 'screen_heat',
    stage: 'screen' as const,
    name: '热度优先筛选',
    tech: 'Rule(好奇驱动) + Insight DB',
    impl: 'rule' as const,
    scenarios: ['hotspot', 'competitor'],
    enabledByDefault: true,
    desc: '按好奇驱动择高选题，适合追热点与竞品监测。',
  };
  constructor(private readonly topicService: TopicService) {}
  async run(_ctx: OpsChainContext): Promise<ScreenResult> {
    const { topics } = await this.topicService.generateTopics({ driver: '好奇', limit: 5 });
    return { topicIds: topics.map((t) => t.id), chosen: topics.length, strategy: this.meta.key };
  }
}

@Injectable()
export class ScreenEmotionStrategy implements OpsStrategy {
  meta = {
    key: 'screen_emotion',
    stage: 'screen' as const,
    name: '情绪共鸣优先筛选',
    tech: 'Hybrid(共鸣情绪) + Insight DB',
    impl: 'hybrid' as const,
    scenarios: ['brand', 'ecommerce'],
    enabledByDefault: true,
    desc: '按共鸣情绪择高，适合品牌种草与电商内容。',
  };
  constructor(private readonly topicService: TopicService) {}
  async run(_ctx: OpsChainContext): Promise<ScreenResult> {
    const { topics } = await this.topicService.generateTopics({ emotion: '共鸣', limit: 5 });
    return { topicIds: topics.map((t) => t.id), chosen: topics.length, strategy: this.meta.key };
  }
}

@Injectable()
export class ScreenConversionStrategy implements OpsStrategy {
  meta = {
    key: 'screen_conversion',
    stage: 'screen' as const,
    name: '转化潜力优先筛选',
    tech: 'Rule(贪驱动) + Insight DB',
    impl: 'rule' as const,
    scenarios: ['ecommerce', 'local-life'],
    enabledByDefault: true,
    desc: '按贪驱动择高，适合带货与本地生活。',
  };
  constructor(private readonly topicService: TopicService) {}
  async run(_ctx: OpsChainContext): Promise<ScreenResult> {
    const { topics } = await this.topicService.generateTopics({ driver: '贪', limit: 5 });
    return { topicIds: topics.map((t) => t.id), chosen: topics.length, strategy: this.meta.key };
  }
}

@Injectable()
export class ScreenNoveltyStrategy implements OpsStrategy {
  meta = {
    key: 'screen_novelty',
    stage: 'screen' as const,
    name: '新颖度优先筛选',
    tech: 'LLM(窥探驱动) + Insight DB',
    impl: 'llm' as const,
    scenarios: ['knowledge'],
    enabledByDefault: true,
    desc: '按窥探驱动择高，避免同质化，适合知识科普。',
  };
  constructor(private readonly topicService: TopicService) {}
  async run(_ctx: OpsChainContext): Promise<ScreenResult> {
    const { topics } = await this.topicService.generateTopics({ driver: '窥探', limit: 5 });
    return { topicIds: topics.map((t) => t.id), chosen: topics.length, strategy: this.meta.key };
  }
}

@Injectable()
export class ScreenCompositeStrategy implements OpsStrategy {
  meta = {
    key: 'screen_composite',
    stage: 'screen' as const,
    name: '综合加权筛选',
    tech: 'Hybrid(全驱动加权) + Insight DB',
    impl: 'hybrid' as const,
    scenarios: ['hotspot', 'brand', 'ecommerce', 'knowledge'],
    enabledByDefault: true,
    desc: '多维度加权综合择优，通用默认筛选策略。',
  };
  constructor(private readonly topicService: TopicService) {}
  async run(_ctx: OpsChainContext): Promise<ScreenResult> {
    const { topics } = await this.topicService.generateTopics({ limit: 5 });
    return { topicIds: topics.map((t) => t.id), chosen: topics.length, strategy: this.meta.key };
  }
}

export const SCREEN_STRATEGIES = [
  ScreenHeatStrategy,
  ScreenEmotionStrategy,
  ScreenConversionStrategy,
  ScreenNoveltyStrategy,
  ScreenCompositeStrategy,
];
