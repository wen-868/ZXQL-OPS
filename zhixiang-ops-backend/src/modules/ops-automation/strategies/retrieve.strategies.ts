import { Injectable } from '@nestjs/common';
import { IntelService } from '../../intel/intel.service';
import { CollectTaskType } from '../../intel/intel.types';
import { OpsChainContext, OpsStrategy, RetrieveResult } from '../ops-automation.types';

/**
 * 检索阶段 5 种实现方案（技术栈/场景/路径多维覆盖）。
 * 统一入口 IntelService.createCollectTask（C 阶段：建采集任务并落库 CollectTaskEntity）。
 * 各策略对应不同采集类型/平台/场景。
 * - douyin_hot：抖音热点榜（L1 开放榜 API 路径，场景=热点追踪）
 * - bilibili_rank：B站排行榜（API 路径，场景=知识科普）
 * - weibo_search：微博关键词搜索（API 路径，场景=话题舆情）
 * - xiaohongshu_brand：小红书品牌词监测（API 路径，场景=品牌种草）
 * - keyword_mine：本地关键词挖掘（rule 路径，场景=评论关键词）
 */

interface RetrieveConfig {
  target?: string;
  keyword?: string;
  brand?: string;
  seed?: string;
}

@Injectable()
export class RetrieveDouyinHotStrategy implements OpsStrategy {
  meta = {
    key: 'retrieve_douyin_hot',
    stage: 'retrieve' as const,
    name: '抖音热点榜检索',
    tech: 'Douyin OpenRank API + IntelService',
    impl: 'api' as const,
    scenarios: ['hotspot', 'ecommerce', 'local-life'],
    enabledByDefault: true,
    desc: '拉取抖音热点榜建立采集任务，适合带货/本地生活选题。',
  };
  constructor(private readonly intelService: IntelService) {}
  async run(ctx: OpsChainContext, config: RetrieveConfig): Promise<RetrieveResult> {
    const task = await this.intelService.createCollectTask({
      type: CollectTaskType.Hot,
      platform: 'douyin',
      target: config?.target ?? 'hot',
      sourceLevel: 'L1',
    });
    return { collectTaskIds: [task.taskId], platform: 'douyin' };
  }
}

@Injectable()
export class RetrieveBilibiliRankStrategy implements OpsStrategy {
  meta = {
    key: 'retrieve_bilibili_rank',
    stage: 'retrieve' as const,
    name: 'B站排行榜检索',
    tech: 'Bilibili Rank API + IntelService',
    impl: 'api' as const,
    scenarios: ['knowledge', 'hotspot'],
    enabledByDefault: true,
    desc: '抓取 B 站分区排行榜，适合知识科普/年轻人向内容。',
  };
  constructor(private readonly intelService: IntelService) {}
  async run(ctx: OpsChainContext, config: RetrieveConfig): Promise<RetrieveResult> {
    const task = await this.intelService.createCollectTask({
      type: CollectTaskType.Hot,
      platform: 'bilibili',
      target: config?.target ?? 'rank',
      sourceLevel: 'L1',
    });
    return { collectTaskIds: [task.taskId], platform: 'bilibili' };
  }
}

@Injectable()
export class RetrieveWeiboSearchStrategy implements OpsStrategy {
  meta = {
    key: 'retrieve_weibo_search',
    stage: 'retrieve' as const,
    name: '微博话题搜索检索',
    tech: 'Weibo Topic Search API + IntelService',
    impl: 'api' as const,
    scenarios: ['hotspot', 'brand', 'comment'],
    enabledByDefault: true,
    desc: '按关键词搜索微博话题与讨论，适合舆情与品牌监测。',
  };
  constructor(private readonly intelService: IntelService) {}
  async run(ctx: OpsChainContext, config: RetrieveConfig): Promise<RetrieveResult> {
    const task = await this.intelService.createCollectTask({
      type: CollectTaskType.Keyword,
      platform: 'weibo',
      target: config?.keyword ?? '行业热点',
      sourceLevel: 'L1',
    });
    return { collectTaskIds: [task.taskId], platform: 'weibo' };
  }
}

@Injectable()
export class RetrieveXiaohongshuBrandStrategy implements OpsStrategy {
  meta = {
    key: 'retrieve_xiaohongshu_brand',
    stage: 'retrieve' as const,
    name: '小红书品牌词监测',
    tech: 'Xiaohongshu Brand Monitor API + IntelService',
    impl: 'api' as const,
    scenarios: ['brand', 'ecommerce'],
    enabledByDefault: true,
    desc: '监测小红书品牌/品类笔记，适合种草与电商选品。',
  };
  constructor(private readonly intelService: IntelService) {}
  async run(ctx: OpsChainContext, config: RetrieveConfig): Promise<RetrieveResult> {
    const task = await this.intelService.createCollectTask({
      type: CollectTaskType.Keyword,
      platform: 'xiaohongshu',
      target: config?.brand ?? '品牌关键词',
      sourceLevel: 'L1',
    });
    return { collectTaskIds: [task.taskId], platform: 'xiaohongshu' };
  }
}

@Injectable()
export class RetrieveKeywordMineStrategy implements OpsStrategy {
  meta = {
    key: 'retrieve_keyword_mine',
    stage: 'retrieve' as const,
    name: '本地关键词挖掘',
    tech: 'Rule-based Keyword Miner (本地规则)',
    impl: 'rule' as const,
    scenarios: ['keyword', 'competitor'],
    enabledByDefault: true,
    desc: '基于本地词库与已采集评论做关键词挖掘，无需外部 API，离线可用。',
  };
  constructor(private readonly intelService: IntelService) {}
  async run(ctx: OpsChainContext, config: RetrieveConfig): Promise<RetrieveResult> {
    const task = await this.intelService.createCollectTask({
      type: CollectTaskType.Keyword,
      platform: 'local',
      target: config?.seed ?? '核心品类词',
      sourceLevel: 'L1',
    });
    return { collectTaskIds: [task.taskId], platform: 'local' };
  }
}

export const RETRIEVE_STRATEGIES = [
  RetrieveDouyinHotStrategy,
  RetrieveBilibiliRankStrategy,
  RetrieveWeiboSearchStrategy,
  RetrieveXiaohongshuBrandStrategy,
  RetrieveKeywordMineStrategy,
];
