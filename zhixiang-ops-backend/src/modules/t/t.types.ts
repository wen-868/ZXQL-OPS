/**
 * T 选品中心对外视图类型（响应信封 data 内容）。
 */

export interface SelectionProductView {
  id: number;
  source: string;
  platform: string | null;
  externalProductId: string | null;
  title: string;
  commissionRate: number;
  reputationScore: number | null;
  sales30d: number;
  price: number | null;
  category: string | null;
  humanDriver: string | null;
  metrics: Record<string, unknown> | null;
  collectedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SelectionListView {
  id: number;
  name: string;
  items: number[];
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/** 榜单条目 */
export interface HotItem {
  id: number;
  title: string;
  commissionRate: number;
  reputationScore: number | null;
  sales30d: number;
  humanDriver: string | null;
}

/** 蓝海词条目 */
export interface BlueOceanItem {
  category: string;
  avgCommissionRate: number;
  avgSales30d: number;
  /** 蓝海度 = 平均佣金率 × 100 / (平均销量 + 1)，越高越「高佣低销」 */
  score: number;
}
