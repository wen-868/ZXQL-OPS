/**
 * S 投流管理类型（规划 §4-S / 开发顺序设计.md）。
 * - 投放账户(千川/ADQ/小店通) + 计划 + 指标；attribution_id 在 S 建计划时生成（ad 类）。
 */

export type AdPlatform = 'douyin' | 'wechat' | 'kuaishou';
export type AdAccountType = 'qianchuan' | 'adq' | 'xiaodian_tong';
export type AdAccountStatus = 'active' | 'expired' | 'banned';
export type AdPlanType = 'standard' | 'full_domain' | 'crowd' | 'bid';
export type AdCampaignStatus = 'draft' | 'running' | 'paused' | 'ended';

export interface AdAccountView {
  id: number;
  platform: AdPlatform;
  type: AdAccountType;
  status: AdAccountStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdCampaignView {
  id: number;
  accountId: number;
  name: string;
  planType: AdPlanType;
  audience: Record<string, unknown> | null;
  budget: number;
  spend: number;
  roi: number;
  attributionId: string;
  status: AdCampaignStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdMetricView {
  id: number;
  campaignId: number;
  date: string;
  impressions: number;
  clicks: number;
  conversions: number;
  cost: number;
  roi: number;
}

export interface AdReviewView {
  campaignId: number;
  attributionId: string;
  totalSpend: number;
  totalCost: number;
  totalConversions: number;
  roi: number;
  metricsCount: number;
}
