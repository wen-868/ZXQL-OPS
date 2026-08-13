/** M 决策仪表盘视图类型（规划 §4-M / 开发顺序 M 仪表盘与 BI） */

/** 核心指标卡（复用 J 五维四率 + 趋势） */
export interface OverviewCards {
  totalPlay: number;
  avgCompleteRate: number;
  totalInteract: number;
  totalFanInc: number;
  totalCommission: number;
  completeRate: number;
  interactRate: number;
  fanRate: number;
  conversionRate: number;
  videoCount: number;
}

export interface TrendPoint {
  date: string;
  play: number;
  interact: number;
}

export interface OverviewView {
  cards: OverviewCards;
  trend: TrendPoint[];
}

/** 全链路漏斗（内容生产率 → 分发覆盖 → 触达 → 互动 → 转化 → 收益） */
export interface FunnelStage {
  name: string;
  value: number;
}

export interface FunnelView {
  stages: FunnelStage[];
  spend: number;
  roi: number;
}

/** 账号对比 */
export interface AccountCompareItem {
  accountId: number;
  nickname?: string;
  platform?: string;
  fansCount: number;
  publishCount: number;
  playShare: number; // 0–1
}

export interface AccountCompareView {
  accounts: AccountCompareItem[];
  totals: { fansCount: number; publishCount: number; play: number };
}

/** 选题效能榜 */
export interface TopicEfficiencyItem {
  driver: string;
  emotion: string;
  topicCount: number;
  avgScore: number;
  avgPlay: number;
  avgConversion: number;
}

export interface TopicEfficiencyView {
  items: TopicEfficiencyItem[];
}

/** 人性钩子分析（7×6，复用 J 人性效能） */
export interface HumanHookItem {
  driver: string;
  emotion: string;
  sampleCount: number;
  avgPlay: number;
  avgInteractRate: number;
  avgConversion: number;
}

export interface HumanHookView {
  items: HumanHookItem[];
}

/** 仪表盘配置视图 */
export interface DashboardView {
  id: number;
  name: string;
  widgets: Array<Record<string, unknown>> | null;
  createdAt: Date;
  updatedAt: Date;
}
