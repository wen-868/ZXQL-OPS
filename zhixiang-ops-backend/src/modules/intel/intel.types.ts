import { Platform } from '../account/account.types';

export { Platform };

/** 采集任务类型（规划 §4-C） */
export enum CollectTaskType {
  Monitor = 'monitor',
  Hot = 'hot',
  Comment = 'comment',
  Keyword = 'keyword',
}

/** 采集任务状态机 */
export enum CollectTaskStatus {
  Pending = 'pending',
  Running = 'running',
  Done = 'done',
  Failed = 'failed',
}

/** 采集来源合规级别：L1 开放 API；L2 授权公开页爬虫（禁止 L3 个体隐私） */
export type SourceLevel = 'L1' | 'L2';

/** 热点类型 */
export enum HotType {
  Video = 'video',
  Live = 'live',
  Topic = 'topic',
  Brand = 'brand',
}

/** 采集来源类型（collected_comments.source_type） */
export enum CollectSourceType {
  Competitor = 'competitor',
  Hot = 'hot',
  Comment = 'comment',
  Keyword = 'keyword',
}
