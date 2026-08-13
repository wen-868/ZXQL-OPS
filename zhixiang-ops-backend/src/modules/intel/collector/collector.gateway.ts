import { Injectable } from '@nestjs/common';
import { CollectorAdapter, NotImplementedCollectorAdapter } from './collector.adapter';
import { LocalCollectorAdapter } from './local-collector.adapter';

/**
 * 采集网关（规划 §4-C / §7）。
 * 按 platform 解析适配器：
 * - 'local'：本地开发适配器，用于本环境跑通全链路
 * - 真实平台（douyin/xiaohongshu/...）：当前返回 NotImplementedCollectorAdapter（独立模式，待接入平台 API）
 * 业务服务只通过本网关取适配器，切换平台实现不影响清洗/去重/审计管线。
 */
@Injectable()
export class CollectorGateway {
  private readonly notImplemented = new NotImplementedCollectorAdapter();
  private readonly local = new LocalCollectorAdapter();

  resolve(platform: string): CollectorAdapter {
    if (platform === 'local') return this.local;
    return this.notImplemented;
  }
}
