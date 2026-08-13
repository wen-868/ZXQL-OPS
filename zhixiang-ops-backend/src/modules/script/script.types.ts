/**
 * 脚本工坊类型与枚举（规划 §4-F）。
 * - 脚本状态机：draft → reviewing → approved → published（含打回与重发）
 * - 合规风险：内嵌违禁词预检（阶段1 不另开 P 模块，留待 P 阶段补完词库治理）
 * - 钩子情绪 hookEmotion ∈ 6 情绪（对齐 analyze.types EMOTION_TYPES）
 * - attribution_id 由 E 选题透传，禁止在 F 重新生成
 */

/** 脚本状态（规划 §4-F） */
export enum ScriptStatus {
  Draft = 'draft',
  Reviewing = 'reviewing',
  Approved = 'approved',
  Published = 'published',
}

export const SCRIPT_STATUSES: ScriptStatus[] = [
  ScriptStatus.Draft,
  ScriptStatus.Reviewing,
  ScriptStatus.Approved,
  ScriptStatus.Published,
];

/** 状态流转白名单（原地流转返回 false） */
export const SCRIPT_TRANSITIONS: Record<ScriptStatus, ScriptStatus[]> = {
  [ScriptStatus.Draft]: [ScriptStatus.Reviewing],
  [ScriptStatus.Reviewing]: [ScriptStatus.Approved, ScriptStatus.Draft],
  [ScriptStatus.Approved]: [ScriptStatus.Published, ScriptStatus.Draft],
  [ScriptStatus.Published]: [ScriptStatus.Draft],
};

export function canScriptTransition(from: ScriptStatus, to: ScriptStatus): boolean {
  if (from === to) return false;
  return (SCRIPT_TRANSITIONS[from] ?? []).includes(to);
}

/** 合规命中级别（none < low < medium < high） */
export type ComplianceLevel = 'none' | 'low' | 'medium' | 'high';

export interface ComplianceHit {
  word: string;
  position: number;
  level: ComplianceLevel;
}

export interface ComplianceRisk {
  hits: ComplianceHit[];
  level: ComplianceLevel;
  checkedAt: string;
}

/** 当前 prompt 版本（随脚本生成逻辑迭代递增） */
export const SCRIPT_PROMPT_VERSION = 'v1';

const LEVEL_RANK: Record<ComplianceLevel, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
};

export function maxLevel(a: ComplianceLevel, b: ComplianceLevel): ComplianceLevel {
  return LEVEL_RANK[a] >= LEVEL_RANK[b] ? a : b;
}

export function hasHighRisk(risk?: ComplianceRisk | null): boolean {
  return !!risk && risk.level === 'high';
}

/** 阶段1 内嵌违禁词种子（极限词/广告法高风险词，P 阶段迁至违禁词库治理） */
export interface BannedWord {
  word: string;
  level: ComplianceLevel;
}

export const BANNED_WORDS: BannedWord[] = [
  { word: '国家级', level: 'high' },
  { word: '最高级', level: 'high' },
  { word: '最佳', level: 'high' },
  { word: '第一品牌', level: 'high' },
  { word: '绝对', level: 'high' },
  { word: '100%', level: 'high' },
  { word: '一夜暴富', level: 'high' },
  { word: '博彩', level: 'high' },
  { word: '最', level: 'medium' },
  { word: '顶级', level: 'medium' },
  { word: '极品', level: 'medium' },
  { word: '全网最低', level: 'medium' },
  { word: '免费送', level: 'low' },
];

/** 脚本模板库（GET /api/ops/script/templates） */
export interface ScriptTemplate {
  id: string;
  name: string;
  structure: string;
}

export const SCRIPT_TEMPLATES: ScriptTemplate[] = [
  {
    id: 'pain-hook',
    name: '痛点开场型',
    structure: '前3秒痛点钩子 → 场景共鸣 → 解决方案 → 行动召唤',
  },
  { id: 'suspense', name: '悬念钩子型', structure: '设疑 → 反转 → 揭秘 → 引导关注' },
  { id: 'compare', name: '对比测评型', structure: '同类对比 → 维度打分 → 结论 → 购买指引' },
  { id: 'emotion', name: '情感共鸣型', structure: '故事引入 → 情绪峰值 → 价值升华 → 互动引导' },
];
