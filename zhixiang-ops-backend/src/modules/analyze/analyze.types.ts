/**
 * 人性分析与洞察引擎类型定义（规划 §4-D / §14）。
 * 7 人性 × 6 情绪 字典（与管理系统 ZXQL-MS 共享常量保持一致）。
 */

/** 分析任务状态机：pending → running → done/failed */
export enum AnalysisStatus {
  Pending = 'pending',
  Running = 'running',
  Done = 'done',
  Failed = 'failed',
}

/** 分析来源（对应情报采集的 source_type / 直播 / 投放） */
export enum AnalysisSource {
  Comments = 'comments',
  Live = 'live',
  Ad = 'ad',
}

/** 7 人性（归因维度） */
export type HumanityDriver = '贪' | '懒' | '怕' | '虚荣' | '窥探' | '孤独爱' | '愤怒不公';

/** 6 情绪（强度维度） */
export type EmotionType = '愤怒' | '共鸣' | '好奇' | '感动' | '焦虑' | '爽感';

export const HUMANITY_DRIVERS: HumanityDriver[] = [
  '贪',
  '懒',
  '怕',
  '虚荣',
  '窥探',
  '孤独爱',
  '愤怒不公',
];

export const EMOTION_TYPES: EmotionType[] = ['愤怒', '共鸣', '好奇', '感动', '焦虑', '爽感'];

/** 单条洞察（沉淀进知识库 / 由聚类产出） */
export interface AnalyzeInsight {
  category: string;
  driver: HumanityDriver;
  emotion: EmotionType;
  title: string;
  content: string;
  tags: string[];
}

/** 能力网关聚类返回的聚合结果结构（prompt §14 JSON Schema 对齐） */
export interface AnalysisClusterResult {
  driverCounts: Partial<Record<HumanityDriver, number>>;
  emotionScores: Partial<Record<EmotionType, number>>;
  topDrivers: HumanityDriver[];
  topEmotions: EmotionType[];
  insights: AnalyzeInsight[];
}
