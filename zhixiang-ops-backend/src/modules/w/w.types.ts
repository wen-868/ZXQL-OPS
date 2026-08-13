/**
 * W 收益与对账 类型（规划 §4-W / 开发顺序设计.md）。
 * 合规边界（§11）：收益数据来自平台开放 API/管理系统 Commission 适配层；敏感字段加密；不扩展采集。
 * 双模式（§17）：联通模式下财务报表仅展示（读管理系统财务），独立模式收益全功能自营。
 */

export type RevenueSource = 'commission' | 'slot_fee' | 'service_fee' | 'tip' | 'subsidy';
export type RevenueStatus = 'pending' | 'settled';
export type ReconciliationStatus = 'pending' | 'matched' | 'diff_found';
export type SettlementType = 'org_talent_advertiser'; // 机构-达人-投手
export type SettlementStatus = 'pending' | 'settled' | 'invoiced';

export interface RevenueRecordView {
  id: number;
  source: RevenueSource;
  platform: string;
  amount: number;
  relatedOrderId: string | null;
  commission: number;
  status: RevenueStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface RevenueSummaryItem {
  source: RevenueSource;
  total: number;
  count: number;
}

export interface ReconciliationView {
  id: number;
  period: string;
  orderAmount: number;
  commissionAmount: number;
  settledAmount: number;
  diff: number;
  status: ReconciliationStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface SettlementPartyView {
  role: string; // org/talent/ad_operator
  name: string;
  amount: number;
}

export interface SettlementView {
  id: number;
  type: SettlementType;
  parties: SettlementPartyView[];
  amount: number;
  status: SettlementStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProfitView {
  totalRevenue: number;
  totalCommission: number;
  totalAdCost: number;
  netProfit: number;
}
