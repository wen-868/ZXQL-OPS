import { Injectable } from '@nestjs/common';
import { CollectorAdapter, NotImplementedCollectorAdapter } from './collector.adapter';
import { LocalCollectorAdapter } from './local-collector.adapter';
import { WebCollectorAdapter } from './web-collector.adapter';

/**
 * 采集网关（规划 §4-C / §7）。
 * 按 platform 解析适配器：
 * - 'local'：本地样本适配器，用于离线联调跑通全链路
 * - 真实平台（douyin/xiaohongshu/kuaishou/bilibili/wechat-channels/weibo/web）：
 *   WebCollectorAdapter —— 公开网页抓取（真实通道，静态/SSR 页面可提取；JS 渲染页面尽力而为）
 * - 其他/未接入平台：NotImplementedCollectorAdapter（显式失败，不静默产出假数据）
 * 业务服务只通过本网关取适配器，切换平台实现不影响清洗/去重/审计管线。
 */
@Injectable()
export class CollectorGateway {
  private readonly notImplemented = new NotImplementedCollectorAdapter();
  private readonly local = new LocalCollectorAdapter();
  private readonly web = new WebCollectorAdapter();

  resolve(platform: string): CollectorAdapter {
    if (platform === 'local') return this.local;
    if (
      ['douyin', 'kuaishou', 'xiaohongshu', 'bilibili', 'wechat-channels', 'weibo', 'web'].includes(
        platform,
      )
    ) {
      return this.web;
    }
    return this.notImplemented;
  }
}
