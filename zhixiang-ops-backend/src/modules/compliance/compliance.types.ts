/**
 * 合规预检类型与枚举（规划 §4-P）。
 * 与 script.types 的 ComplianceLevel/ComplianceHit 结构保持一致，便于 F 直接复用结果。
 */
import { ComplianceWordLevel } from './compliance-word.entity';

/** 合规命中级别（none < low < medium < high） */
export type ComplianceLevel = 'none' | 'low' | 'medium' | 'high';

export interface ComplianceHit {
  word: string;
  position: number;
  level: ComplianceLevel;
}

export type ComplianceResult = 'pass' | 'warn' | 'block';

/** checkText 返回：命中列表 + 最高级别 + 评分 + 处置建议 */
export interface ComplianceCheckResult {
  hits: ComplianceHit[];
  level: ComplianceLevel;
  score: number;
  result: ComplianceResult;
}

const LEVEL_RANK: Record<ComplianceLevel, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
};

export function maxLevel(a: ComplianceLevel, b: ComplianceLevel): ComplianceLevel {
  return LEVEL_RANK[a] >= LEVEL_RANK[b] ? a : b;
}

/** 阶段1 内嵌违禁词种子（极限词/广告法高风险词），迁至 P 违禁词库治理（首次 lazy seed） */
export interface BannedWord {
  word: string;
  level: ComplianceWordLevel;
  category?: string;
}

export const BANNED_WORDS: BannedWord[] = [
  { word: '国家级', level: 'high', category: '广告法' },
  { word: '最高级', level: 'high', category: '广告法' },
  { word: '最佳', level: 'high', category: '广告法' },
  { word: '第一品牌', level: 'high', category: '广告法' },
  { word: '绝对', level: 'high', category: '广告法' },
  { word: '100%', level: 'high', category: '广告法' },
  { word: '一夜暴富', level: 'high', category: '财经' },
  { word: '博彩', level: 'high', category: '违法' },
  { word: '最', level: 'medium', category: '广告法' },
  { word: '顶级', level: 'medium', category: '广告法' },
  { word: '极品', level: 'medium', category: '广告法' },
  { word: '全网最低', level: 'medium', category: '广告法' },
  { word: '免费送', level: 'low', category: '营销' },
];
