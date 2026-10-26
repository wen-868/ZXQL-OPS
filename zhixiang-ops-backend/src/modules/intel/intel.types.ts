import { Platform } from '../account/account.types';

export { Platform };

/** 采集任务类型（规划 §4-C） */
export enum CollectTaskType {
  Monitor = 'monitor',
  Hot = 'hot',
  Comment = 'comment',
  Keyword = 'keyword',
}

/** 采集任务状态机（含人工控制态：paused / cancelled） */
export enum CollectTaskStatus {
  Pending = 'pending',
  Running = 'running',
  Paused = 'paused',
  Cancelled = 'cancelled',
  Done = 'done',
  Failed = 'failed',
}

/** 评论审核状态：pending 待审 / approved 通过（可被 D 消费）/ rejected 弃用 */
export enum CommentReviewStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
}

/** 清洗开关（可按任务覆盖）：去重 / PII 剥离 / 广告过滤 */
export interface CleaningOptions {
  dedup?: boolean;
  piiStrip?: boolean;
  adFilter?: boolean;
  /** 采集结果是否进入人工审核（true 则落库为 pending，D 只消费 approved） */
  reviewRequired?: boolean;
}

/** 采集任务人工控制动作 */
export enum CollectControlAction {
  Pause = 'pause',
  Resume = 'resume',
  Cancel = 'cancel',
  Retry = 'retry',
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
