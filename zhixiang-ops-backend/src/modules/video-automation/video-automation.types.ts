/**
 * 视频全链路自动化类型定义。
 * 与运营自动化(ops-automation)区分：本模块面向「短视频生产全链路」，
 * 阶段为 情报采集(C)→人性分析(D)→选题(E)→脚本(F)→素材(G)→成片(H)→发布投流(I)→数据回收验证(L)。
 */

/** 视频全链路阶段（8 阶段，每阶段 ≥5 策略） */
export type VideoStage =
  | 'intel' // 情报采集 C
  | 'analyze' // 人性分析 D
  | 'topic' // 选题 E
  | 'script' // 脚本 F
  | 'material' // 素材 G
  | 'compose' // 成片 H
  | 'publish' // 发布投流 I
  | 'recycle'; // 数据回收验证 L

export const VIDEO_STAGES: VideoStage[] = [
  'intel',
  'analyze',
  'topic',
  'script',
  'material',
  'compose',
  'publish',
  'recycle',
];

/** 策略实现路径（用于覆盖技术栈/实现路径维度） */
export type ImplPath = 'llm' | 'rule' | 'api' | 'local' | 'hybrid';

/** 场景标签（覆盖场景维度） */
export type ScenarioTag =
  | 'hotspot'
  | 'competitor'
  | 'comment'
  | 'keyword'
  | 'brand'
  | 'ecommerce'
  | 'local-life'
  | 'knowledge'
  | 'compliance'
  | 'realtime';

export interface StrategyMeta {
  key: string;
  stage: VideoStage;
  name: string;
  tech: string;
  impl: ImplPath;
  scenarios: ScenarioTag[] | string[];
  enabledByDefault: boolean;
  desc: string;
}

export interface VideoStrategy<C = any, R = VideoStageResult> {
  meta: StrategyMeta;
  run(ctx: VideoChainContext, config: C): Promise<R>;
}

/** 全链路上下文：产物沿链透传，供后续阶段与验证闭环使用 */
export interface VideoChainContext {
  tenantId: string;
  chainRunId?: string;
  attributionId?: string;
  collectTaskIds?: number[]; // 情报采集任务
  analysisTaskIds?: number[]; // 人性分析任务
  topicIds?: number[]; // 选题
  scriptIds?: number[]; // 脚本
  materialIds?: number[]; // 素材
  videoIds?: number[]; // 成片
  publishTaskIds?: number[]; // 发布任务
  recycleTaskIds?: number[]; // 回收验证任务
}

export interface VideoStageResult {
  strategy: string;
  collectTaskIds?: number[];
  analysisTaskIds?: number[];
  topicIds?: number[];
  scriptIds?: number[];
  materialIds?: number[];
  videoIds?: number[];
  publishTaskIds?: number[];
  recycleTaskIds?: number[];
  degraded?: boolean;
  note?: string;
}
