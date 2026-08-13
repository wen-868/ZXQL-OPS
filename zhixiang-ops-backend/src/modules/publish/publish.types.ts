/**
 * 发布与分发类型与枚举（规划 §4-I / 开发顺序第6步）。
 * - 发布状态机（阶段1 简化）：queued → published（独立运行模拟回执；连接模式走集成层）
 * - attribution_id 由 F 脚本透传，禁止在 I 重新生成（§12 链路只读透传）
 * - 发布前合规校验复用 F 脚本的 complianceRisk（阶段1 不另开 P 模块）
 */

/** 发布任务状态 */
export enum PublishStatus {
  Queued = 'queued',
  Running = 'running',
  Done = 'done',
  Failed = 'failed',
  Published = 'published',
  Retry = 'retry',
}

export const PUBLISH_STATUSES: PublishStatus[] = [
  PublishStatus.Queued,
  PublishStatus.Running,
  PublishStatus.Done,
  PublishStatus.Failed,
  PublishStatus.Published,
  PublishStatus.Retry,
];

/** 可发布脚本状态（须已审/已发） */
export const PUBLISHABLE_SCRIPT_STATUSES = ['approved', 'published'] as const;
