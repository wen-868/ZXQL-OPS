import { Injectable } from '@nestjs/common';
import { PublishService } from '../../publish/publish.service';
import { Platform } from '../../account/account.types';
import { OpsChainContext, OpsStrategy, DeliverResult } from '../ops-automation.types';

/**
 * 投流阶段 5 种实现方案（多渠道分发，技术栈/路径多维覆盖）。
 * 统一入口 PublishService.publish（I 阶段：脚本→多渠道账号分发→平台回执/降级模拟）。
 * 各策略自动解析该平台下首个可用账号 accountId（免人工指定），无账号时降级跳过。
 * - douyin：抖音短视频投流（api，电商/本地生活）
 * - kuaishou：快手投流（api，下沉市场带货）
 * - xiaohongshu：小红书图文/视频投流（api，品牌种草）
 * - bilibili：B站投流（api，知识科普）
 * - wechat：视频号投流（api，私域/品牌）
 */

@Injectable()
export class DeliverDouyinStrategy implements OpsStrategy {
  meta = {
    key: 'deliver_douyin',
    stage: 'deliver' as const,
    name: '抖音投流',
    tech: 'Douyin OpenAPI + PublishService',
    impl: 'api' as const,
    scenarios: ['ecommerce', 'local-life', 'hotspot'],
    enabledByDefault: true,
    desc: '抖音渠道分发，支持真实 API（配齐凭证）或降级模拟回执。',
  };
  constructor(private readonly publishService: PublishService) {}
  async run(ctx: OpsChainContext): Promise<DeliverResult> {
    return deliverTo(this.publishService, ctx, 'douyin');
  }
}

@Injectable()
export class DeliverKuaishouStrategy implements OpsStrategy {
  meta = {
    key: 'deliver_kuaishou',
    stage: 'deliver' as const,
    name: '快手投流',
    tech: 'Kuaishou OpenAPI + PublishService',
    impl: 'api' as const,
    scenarios: ['ecommerce'],
    enabledByDefault: true,
    desc: '快手渠道分发，适合下沉市场带货。',
  };
  constructor(private readonly publishService: PublishService) {}
  async run(ctx: OpsChainContext): Promise<DeliverResult> {
    return deliverTo(this.publishService, ctx, 'kuaishou');
  }
}

@Injectable()
export class DeliverXiaohongshuStrategy implements OpsStrategy {
  meta = {
    key: 'deliver_xiaohongshu',
    stage: 'deliver' as const,
    name: '小红书投流',
    tech: 'Xiaohongshu OpenAPI + PublishService',
    impl: 'api' as const,
    scenarios: ['brand', 'ecommerce'],
    enabledByDefault: true,
    desc: '小红书渠道分发，适合品牌种草与电商。',
  };
  constructor(private readonly publishService: PublishService) {}
  async run(ctx: OpsChainContext): Promise<DeliverResult> {
    return deliverTo(this.publishService, ctx, 'xiaohongshu');
  }
}

@Injectable()
export class DeliverBilibiliStrategy implements OpsStrategy {
  meta = {
    key: 'deliver_bilibili',
    stage: 'deliver' as const,
    name: 'B站投流',
    tech: 'Bilibili OpenAPI + PublishService',
    impl: 'api' as const,
    scenarios: ['knowledge'],
    enabledByDefault: true,
    desc: 'B站渠道分发，适合知识科普/年轻人向内容。',
  };
  constructor(private readonly publishService: PublishService) {}
  async run(ctx: OpsChainContext): Promise<DeliverResult> {
    return deliverTo(this.publishService, ctx, 'bilibili');
  }
}

@Injectable()
export class DeliverWechatStrategy implements OpsStrategy {
  meta = {
    key: 'deliver_wechat',
    stage: 'deliver' as const,
    name: '视频号投流',
    tech: 'WeChat Channels API + PublishService',
    impl: 'api' as const,
    scenarios: ['brand', 'local-life'],
    enabledByDefault: true,
    desc: '微信视频号渠道分发，适合私域与品牌。',
  };
  constructor(private readonly publishService: PublishService) {}
  async run(ctx: OpsChainContext): Promise<DeliverResult> {
    return deliverTo(this.publishService, ctx, 'wechat-channels');
  }
}

/** 通道级分发：自动解析该平台默认账号，逐脚本建发布任务 */
async function deliverTo(
  publishService: PublishService,
  ctx: OpsChainContext,
  platform: string,
): Promise<DeliverResult> {
  const accountId = await publishService.resolveDefaultAccount(platform as Platform);
  const ids: number[] = [];
  for (const scriptId of ctx.scriptIds ?? []) {
    if (!accountId) {
      // 无账号则跳过该脚本（降级：不阻断全链路）
      continue;
    }
    const { taskIds } = await publishService.publish({
      scriptId,
      accountIds: [accountId],
      platform,
    });
    ids.push(...taskIds);
  }
  return { publishTaskIds: ids, channels: [platform] };
}

export const DELIVER_STRATEGIES = [
  DeliverDouyinStrategy,
  DeliverKuaishouStrategy,
  DeliverXiaohongshuStrategy,
  DeliverBilibiliStrategy,
  DeliverWechatStrategy,
];
