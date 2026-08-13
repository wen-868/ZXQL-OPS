import { Injectable, Type } from '@nestjs/common';
import { IntelService } from '../../intel/intel.service';
import { CollectTaskType } from '../../intel/intel.types';
import {
  StrategyMeta,
  VideoChainContext,
  VideoStrategy,
  VideoStageResult,
} from '../video-automation.types';

interface IntelCfg {
  type: CollectTaskType;
  platform: string;
  target: string;
}

/**
 * 情报采集阶段（C）5 策略：覆盖热点/竞品监控/评论/关键词多平台、多实现路径。
 * 统一调用 IntelService.createCollectTask（sourceLevel=L1 轻量采集）。
 */
@Injectable()
export class IntelHotDouyinStrategy implements VideoStrategy {
  meta: StrategyMeta = {
    key: 'intel_hot_douyin',
    stage: 'intel',
    name: '抖音热点采集',
    tech: 'IntelService.createCollectTask(Hot)',
    impl: 'api',
    scenarios: ['hotspot', 'realtime'],
    enabledByDefault: true,
    desc: '采集抖音平台实时热门话题与爆款视频线索',
  };
  constructor(private readonly intel: IntelService) {}
  async run(_ctx: VideoChainContext): Promise<VideoStageResult> {
    const cfg: IntelCfg = { type: CollectTaskType.Hot, platform: 'douyin', target: '热门话题' };
    const task = await this.intel.createCollectTask({
      type: cfg.type,
      platform: cfg.platform,
      target: cfg.target,
      sourceLevel: 'L1',
    });
    return { strategy: this.meta.key, collectTaskIds: [task.taskId] };
  }
}

@Injectable()
export class IntelHotBilibiliStrategy implements VideoStrategy {
  meta: StrategyMeta = {
    key: 'intel_hot_bilibili',
    stage: 'intel',
    name: 'B站榜单采集',
    tech: 'IntelService.createCollectTask(Hot)',
    impl: 'api',
    scenarios: ['hotspot', 'knowledge'],
    enabledByDefault: true,
    desc: '采集 B 站排行榜与知识区热点，作为中长视频选题来源',
  };
  constructor(private readonly intel: IntelService) {}
  async run(_ctx: VideoChainContext): Promise<VideoStageResult> {
    const task = await this.intel.createCollectTask({
      type: CollectTaskType.Hot,
      platform: 'bilibili',
      target: '热门',
      sourceLevel: 'L1',
    });
    return { strategy: this.meta.key, collectTaskIds: [task.taskId] };
  }
}

@Injectable()
export class IntelCommentKuaishouStrategy implements VideoStrategy {
  meta: StrategyMeta = {
    key: 'intel_comment_kuaishou',
    stage: 'intel',
    name: '快手评论洞察采集',
    tech: 'IntelService.createCollectTask(Comment)',
    impl: 'api',
    scenarios: ['comment', 'ecommerce'],
    enabledByDefault: true,
    desc: '采集快手评论区舆情，挖掘用户真实痛点与购买意向',
  };
  constructor(private readonly intel: IntelService) {}
  async run(_ctx: VideoChainContext): Promise<VideoStageResult> {
    const task = await this.intel.createCollectTask({
      type: CollectTaskType.Comment,
      platform: 'kuaishou',
      target: '评论洞察',
      sourceLevel: 'L1',
    });
    return { strategy: this.meta.key, collectTaskIds: [task.taskId] };
  }
}

@Injectable()
export class IntelKeywordXhsStrategy implements VideoStrategy {
  meta: StrategyMeta = {
    key: 'intel_keyword_xhs',
    stage: 'intel',
    name: '小红书种草关键词采集',
    tech: 'IntelService.createCollectTask(Keyword)',
    impl: 'api',
    scenarios: ['keyword', 'brand'],
    enabledByDefault: true,
    desc: '采集小红书种草关键词与品牌声量，定位垂类机会',
  };
  constructor(private readonly intel: IntelService) {}
  async run(_ctx: VideoChainContext): Promise<VideoStageResult> {
    const task = await this.intel.createCollectTask({
      type: CollectTaskType.Keyword,
      platform: 'xiaohongshu',
      target: '种草关键词',
      sourceLevel: 'L1',
    });
    return { strategy: this.meta.key, collectTaskIds: [task.taskId] };
  }
}

@Injectable()
export class IntelMonitorCompetitorStrategy implements VideoStrategy {
  meta: StrategyMeta = {
    key: 'intel_monitor_competitor',
    stage: 'intel',
    name: '竞品账号监控采集',
    tech: 'IntelService.createCollectTask(Monitor)',
    impl: 'api',
    scenarios: ['competitor', 'brand'],
    enabledByDefault: true,
    desc: '监控竞品账号更新节奏与爆款规律，做差异化跟进',
  };
  constructor(private readonly intel: IntelService) {}
  async run(_ctx: VideoChainContext): Promise<VideoStageResult> {
    const task = await this.intel.createCollectTask({
      type: CollectTaskType.Monitor,
      platform: 'douyin',
      target: '竞品账号',
      sourceLevel: 'L1',
    });
    return { strategy: this.meta.key, collectTaskIds: [task.taskId] };
  }
}

export const INTEL_STRATEGIES: Type<VideoStrategy>[] = [
  IntelHotDouyinStrategy,
  IntelHotBilibiliStrategy,
  IntelCommentKuaishouStrategy,
  IntelKeywordXhsStrategy,
  IntelMonitorCompetitorStrategy,
];
