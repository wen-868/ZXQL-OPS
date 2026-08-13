/**
 * 数据监控与回收类型与枚举（规划 §4-J / 开发顺序第8步）。
 * 回收 I 发布数据回流 D 再分析；attribution_id 透传 I（F→I→J 只读）。
 */

/** 回收范围 */
export enum RecycleScope {
  Video = 'video',
  Account = 'account',
  All = 'all',
}

export const RECYCLE_SCOPES: RecycleScope[] = [
  RecycleScope.Video,
  RecycleScope.Account,
  RecycleScope.All,
];

/** 回收任务状态 */
export enum RecycleStatus {
  Pending = 'pending',
  Running = 'running',
  Done = 'done',
  Failed = 'failed',
}

export const RECYCLE_STATUSES: RecycleStatus[] = [
  RecycleStatus.Pending,
  RecycleStatus.Running,
  RecycleStatus.Done,
  RecycleStatus.Failed,
];

/** 回收指标（五维：播放/完播率/互动/涨粉/佣金） */
export interface RecycleMetrics {
  play?: number;
  completeRate?: number;
  interact?: number;
  fanInc?: number;
  commission?: number;
  [k: string]: number | undefined;
}
