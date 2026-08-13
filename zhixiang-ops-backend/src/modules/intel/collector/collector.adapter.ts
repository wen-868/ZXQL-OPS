import { AppError } from '../../../shared/app-error';
import { HotType } from '../intel.types';
import { CollectTaskEntity } from '../collect-task.entity';

/** 平台原始评论（采集网关从适配器拿到后交由服务清洗去重） */
export interface RawComment {
  sourceRef: string;
  content: string;
  authorId?: string;
  likes?: number;
  collectedAt?: Date;
}

/** 平台原始热点 */
export interface RawHot {
  hotType: HotType;
  title: string;
  heat: number;
  url?: string;
}

/**
 * 采集适配器接口（规划 §7 / §4-C）。
 * 业务管线只依赖此接口，不感知具体平台实现；
 * 真实平台（douyin 等）接入后实现本接口，由 CollectorGateway 按 platform 解析切换。
 */
export interface CollectorAdapter {
  fetchComments(task: CollectTaskEntity): Promise<RawComment[]>;
  fetchHot(platform: string, hotType: HotType): Promise<RawHot[]>;
  mineKeywords(platform: string, target: string): Promise<string[]>;
}

/**
 * 未接入适配（独立模式默认）。
 * 所有方法统一抛 NOT_IMPLEMENTED，业务经接口调用不感知模式差异；
 * connected 模式接入平台 API 时替换为真实实现。
 */
export class NotImplementedCollectorAdapter implements CollectorAdapter {
  private fail(): never {
    throw new AppError('NOT_IMPLEMENTED');
  }

  fetchComments(): Promise<RawComment[]> {
    return this.fail();
  }
  fetchHot(): Promise<RawHot[]> {
    return this.fail();
  }
  mineKeywords(): Promise<string[]> {
    return this.fail();
  }
}
