import { Injectable, Type } from '@nestjs/common';
import { Platform } from '../../account/account.types';
import { PublishService } from '../../publish/publish.service';
import {
  StrategyMeta,
  VideoChainContext,
  VideoStrategy,
  VideoStageResult,
} from '../video-automation.types';

/**
 * 发布投流阶段（I）5 策略：覆盖抖音/快手/小红书/B站/微信视频号多平台。
 * 每脚本经 PublishService.resolveDefaultAccount + publish 投流（无凭证降级模拟回执）。
 */
@Injectable()
export class PublishDouyinStrategy implements VideoStrategy {
  meta: StrategyMeta = {
    key: 'publish_douyin',
    stage: 'publish',
    name: '抖音发布投流',
    tech: 'PublishService.publish(platform=douyin)',
    impl: 'api',
    scenarios: ['hotspot', 'ecommerce', 'realtime'],
    enabledByDefault: true,
    desc: '抖音发布并投流（配齐凭证调真实 API）',
  };
  constructor(private readonly publish: PublishService) {}
  async run(ctx: VideoChainContext): Promise<VideoStageResult> {
    const platform: Platform = 'douyin';
    const accountId = await this.publish.resolveDefaultAccount(platform);
    const ids: number[] = [];
    for (const scriptId of ctx.scriptIds ?? []) {
      if (!accountId) continue;
      const task = await this.publish.publish({ scriptId, accountIds: [accountId], platform });
      ids.push(...task.taskIds);
    }
    return { strategy: this.meta.key, publishTaskIds: ids };
  }
}

@Injectable()
export class PublishKuaishouStrategy implements VideoStrategy {
  meta: StrategyMeta = {
    key: 'publish_kuaishou',
    stage: 'publish',
    name: '快手发布投流',
    tech: 'PublishService.publish(platform=kuaishou)',
    impl: 'api',
    scenarios: ['ecommerce', 'realtime'],
    enabledByDefault: true,
    desc: '快手发布并投流',
  };
  constructor(private readonly publish: PublishService) {}
  async run(ctx: VideoChainContext): Promise<VideoStageResult> {
    const platform: Platform = 'kuaishou';
    const accountId = await this.publish.resolveDefaultAccount(platform);
    const ids: number[] = [];
    for (const scriptId of ctx.scriptIds ?? []) {
      if (!accountId) continue;
      const task = await this.publish.publish({ scriptId, accountIds: [accountId], platform });
      ids.push(...task.taskIds);
    }
    return { strategy: this.meta.key, publishTaskIds: ids };
  }
}

@Injectable()
export class PublishXhsStrategy implements VideoStrategy {
  meta: StrategyMeta = {
    key: 'publish_xiaohongshu',
    stage: 'publish',
    name: '小红书发布投流',
    tech: 'PublishService.publish(platform=xiaohongshu)',
    impl: 'api',
    scenarios: ['brand', 'knowledge'],
    enabledByDefault: true,
    desc: '小红书发布并投流',
  };
  constructor(private readonly publish: PublishService) {}
  async run(ctx: VideoChainContext): Promise<VideoStageResult> {
    const platform: Platform = 'xiaohongshu';
    const accountId = await this.publish.resolveDefaultAccount(platform);
    const ids: number[] = [];
    for (const scriptId of ctx.scriptIds ?? []) {
      if (!accountId) continue;
      const task = await this.publish.publish({ scriptId, accountIds: [accountId], platform });
      ids.push(...task.taskIds);
    }
    return { strategy: this.meta.key, publishTaskIds: ids };
  }
}

@Injectable()
export class PublishBilibiliStrategy implements VideoStrategy {
  meta: StrategyMeta = {
    key: 'publish_bilibili',
    stage: 'publish',
    name: 'B站发布投流',
    tech: 'PublishService.publish(platform=bilibili)',
    impl: 'api',
    scenarios: ['knowledge'],
    enabledByDefault: true,
    desc: 'B 站发布（中长视频适配）',
  };
  constructor(private readonly publish: PublishService) {}
  async run(ctx: VideoChainContext): Promise<VideoStageResult> {
    const platform: Platform = 'bilibili';
    const accountId = await this.publish.resolveDefaultAccount(platform);
    const ids: number[] = [];
    for (const scriptId of ctx.scriptIds ?? []) {
      if (!accountId) continue;
      const task = await this.publish.publish({ scriptId, accountIds: [accountId], platform });
      ids.push(...task.taskIds);
    }
    return { strategy: this.meta.key, publishTaskIds: ids };
  }
}

@Injectable()
export class PublishWechatStrategy implements VideoStrategy {
  meta: StrategyMeta = {
    key: 'publish_wechat',
    stage: 'publish',
    name: '微信视频号发布投流',
    tech: 'PublishService.publish(platform=wechat-channels)',
    impl: 'api',
    scenarios: ['brand', 'ecommerce'],
    enabledByDefault: true,
    desc: '微信视频号发布并投流',
  };
  constructor(private readonly publish: PublishService) {}
  async run(ctx: VideoChainContext): Promise<VideoStageResult> {
    const platform: Platform = 'wechat-channels';
    const accountId = await this.publish.resolveDefaultAccount(platform);
    const ids: number[] = [];
    for (const scriptId of ctx.scriptIds ?? []) {
      if (!accountId) continue;
      const task = await this.publish.publish({ scriptId, accountIds: [accountId], platform });
      ids.push(...task.taskIds);
    }
    return { strategy: this.meta.key, publishTaskIds: ids };
  }
}

export const PUBLISH_STRATEGIES: Type<VideoStrategy>[] = [
  PublishDouyinStrategy,
  PublishKuaishouStrategy,
  PublishXhsStrategy,
  PublishBilibiliStrategy,
  PublishWechatStrategy,
];
