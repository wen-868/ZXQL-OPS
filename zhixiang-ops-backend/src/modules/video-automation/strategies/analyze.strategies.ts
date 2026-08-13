import { Injectable, Type } from '@nestjs/common';
import { AnalyzeService } from '../../analyze/analyze.service';
import { AnalysisSource } from '../../analyze/analyze.types';
import {
  StrategyMeta,
  VideoChainContext,
  VideoStrategy,
  VideoStageResult,
} from '../video-automation.types';

/**
 * 人性分析阶段（D）5 策略：覆盖评论/直播/广告多来源、多平台。
 * 调用 AnalyzeService.createAnalysisTask；无人评论时降级为无输入（选题回退知识库）。
 */
@Injectable()
export class AnalyzeCommentsDouyinStrategy implements VideoStrategy {
  meta: StrategyMeta = {
    key: 'analyze_comments_douyin',
    stage: 'analyze',
    name: '抖音评论人性分析',
    tech: 'AnalyzeService.createAnalysisTask(Comments)',
    impl: 'llm',
    scenarios: ['comment', 'ecommerce'],
    enabledByDefault: true,
    desc: '分析抖音评论区人性驱动（贪懒怕虚荣等）与情绪分布',
  };
  constructor(private readonly analyze: AnalyzeService) {}
  async run(_ctx: VideoChainContext): Promise<VideoStageResult> {
    try {
      const { taskId } = await this.analyze.createAnalysisTask({
        source: AnalysisSource.Comments,
        platform: 'douyin',
        commentLimit: 30,
      });
      return { strategy: this.meta.key, analysisTaskIds: [taskId] };
    } catch (e) {
      // 人性分析依赖评论数据/库结构；任一不可用时降级为无输入，选题阶段回退知识库聚合（best-effort，不中断全链路）
      return {
        strategy: this.meta.key,
        analysisTaskIds: [],
        degraded: true,
        note: e instanceof Error ? e.message : 'analyze unavailable',
      };
    }
  }
}

@Injectable()
export class AnalyzeLiveKuaishouStrategy implements VideoStrategy {
  meta: StrategyMeta = {
    key: 'analyze_live_kuaishou',
    stage: 'analyze',
    name: '快手直播人性分析',
    tech: 'AnalyzeService.createAnalysisTask(Live)',
    impl: 'llm',
    scenarios: ['realtime', 'ecommerce'],
    enabledByDefault: true,
    desc: '分析快手直播间弹幕与互动的人性驱动',
  };
  constructor(private readonly analyze: AnalyzeService) {}
  async run(_ctx: VideoChainContext): Promise<VideoStageResult> {
    try {
      const { taskId } = await this.analyze.createAnalysisTask({
        source: AnalysisSource.Live,
        platform: 'kuaishou',
        commentLimit: 30,
      });
      return { strategy: this.meta.key, analysisTaskIds: [taskId] };
    } catch (e) {
      // 人性分析依赖评论数据/库结构；任一不可用时降级为无输入，选题阶段回退知识库聚合（best-effort，不中断全链路）
      return {
        strategy: this.meta.key,
        analysisTaskIds: [],
        degraded: true,
        note: e instanceof Error ? e.message : 'analyze unavailable',
      };
    }
  }
}

@Injectable()
export class AnalyzeAdCompetitorStrategy implements VideoStrategy {
  meta: StrategyMeta = {
    key: 'analyze_ad_competitor',
    stage: 'analyze',
    name: '竞品广告人性分析',
    tech: 'AnalyzeService.createAnalysisTask(Ad)',
    impl: 'llm',
    scenarios: ['competitor', 'brand'],
    enabledByDefault: true,
    desc: '分析竞品投放广告的转化话术与人性抓手',
  };
  constructor(private readonly analyze: AnalyzeService) {}
  async run(_ctx: VideoChainContext): Promise<VideoStageResult> {
    try {
      const { taskId } = await this.analyze.createAnalysisTask({
        source: AnalysisSource.Ad,
        platform: 'douyin',
        commentLimit: 20,
      });
      return { strategy: this.meta.key, analysisTaskIds: [taskId] };
    } catch (e) {
      // 人性分析依赖评论数据/库结构；任一不可用时降级为无输入，选题阶段回退知识库聚合（best-effort，不中断全链路）
      return {
        strategy: this.meta.key,
        analysisTaskIds: [],
        degraded: true,
        note: e instanceof Error ? e.message : 'analyze unavailable',
      };
    }
  }
}

@Injectable()
export class AnalyzeCommentsXhsStrategy implements VideoStrategy {
  meta: StrategyMeta = {
    key: 'analyze_comments_xhs',
    stage: 'analyze',
    name: '小红书评论人性分析',
    tech: 'AnalyzeService.createAnalysisTask(Comments)',
    impl: 'llm',
    scenarios: ['comment', 'brand'],
    enabledByDefault: true,
    desc: '分析小红书种草笔记评论的人性驱动与情绪',
  };
  constructor(private readonly analyze: AnalyzeService) {}
  async run(_ctx: VideoChainContext): Promise<VideoStageResult> {
    try {
      const { taskId } = await this.analyze.createAnalysisTask({
        source: AnalysisSource.Comments,
        platform: 'xiaohongshu',
        commentLimit: 30,
      });
      return { strategy: this.meta.key, analysisTaskIds: [taskId] };
    } catch (e) {
      // 人性分析依赖评论数据/库结构；任一不可用时降级为无输入，选题阶段回退知识库聚合（best-effort，不中断全链路）
      return {
        strategy: this.meta.key,
        analysisTaskIds: [],
        degraded: true,
        note: e instanceof Error ? e.message : 'analyze unavailable',
      };
    }
  }
}

@Injectable()
export class AnalyzeCommentsBilibiliStrategy implements VideoStrategy {
  meta: StrategyMeta = {
    key: 'analyze_comments_bilibili',
    stage: 'analyze',
    name: 'B站评论人性分析',
    tech: 'AnalyzeService.createAnalysisTask(Comments)',
    impl: 'llm',
    scenarios: ['comment', 'knowledge'],
    enabledByDefault: true,
    desc: '分析 B 站中长视频评论区的人性驱动与知识诉求',
  };
  constructor(private readonly analyze: AnalyzeService) {}
  async run(_ctx: VideoChainContext): Promise<VideoStageResult> {
    try {
      const { taskId } = await this.analyze.createAnalysisTask({
        source: AnalysisSource.Comments,
        platform: 'bilibili',
        commentLimit: 30,
      });
      return { strategy: this.meta.key, analysisTaskIds: [taskId] };
    } catch (e) {
      // 人性分析依赖评论数据/库结构；任一不可用时降级为无输入，选题阶段回退知识库聚合（best-effort，不中断全链路）
      return {
        strategy: this.meta.key,
        analysisTaskIds: [],
        degraded: true,
        note: e instanceof Error ? e.message : 'analyze unavailable',
      };
    }
  }
}

export const ANALYZE_STRATEGIES: Type<VideoStrategy>[] = [
  AnalyzeCommentsDouyinStrategy,
  AnalyzeLiveKuaishouStrategy,
  AnalyzeAdCompetitorStrategy,
  AnalyzeCommentsXhsStrategy,
  AnalyzeCommentsBilibiliStrategy,
];
