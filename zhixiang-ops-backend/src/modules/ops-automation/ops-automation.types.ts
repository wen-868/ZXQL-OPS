/**
 * 运营全链路自动化技能类型定义（阶段补完）。
 *
 * 目标：为同一运营功能领域的每个阶段（检索/筛选/上架/投流/验证）提供
 * ≥5 个可互换实现方案，覆盖不同技术栈、场景与实现路径；全部通过
 * OpsStrategyRegistry 统一注册、按 tenant 选择最优/指定策略自动执行，
 * 由 AutoChainService 串联成免人工干预的端到端流水线。
 */

/** 自动化阶段标识 */
export type OpsStage =
  | 'retrieve' // 检索：采集外部素材/热点/竞品/评论
  | 'screen' // 筛选：从洞察选题并评分择优
  | 'publish-up' // 上架：脚本/素材/成片生成（带货内容生产）
  | 'deliver' // 投流：多渠道分发与投放
  | 'verify'; // 验证：回收数据、度量、回流再训练

export const OPS_STAGES: OpsStage[] = ['retrieve', 'screen', 'publish-up', 'deliver', 'verify'];

/** 实现路径维度标签（满足"实现路径多维度覆盖"要求） */
export type ImplPath =
  | 'llm' // 大模型生成
  | 'rule' // 规则/启发式
  | 'api' // 外部平台 API
  | 'local' // 本地/离线模拟
  | 'hybrid'; // 混合（规则+模型）

/** 场景维度标签 */
export type ScenarioTag =
  | 'hotspot' // 热点追踪
  | 'competitor' // 竞品监测
  | 'comment' // 评论挖掘
  | 'keyword' // 关键词检索
  | 'ecommerce' // 电商带货
  | 'brand' // 品牌种草
  | 'local-life' // 本地生活
  | 'knowledge' // 知识科普
  | 'compliance' // 合规校验
  | 'realtime'; // 实时回流

/** 策略元信息（注册时登记，用于检索/筛选/展示） */
export interface StrategyMeta {
  /** 唯一 key，如 retrieve_douyin_hot */
  key: string;
  /** 阶段 */
  stage: OpsStage;
  /** 人类可读名称 */
  name: string;
  /** 技术栈描述 */
  tech: string;
  /** 实现路径维度 */
  impl: ImplPath;
  /** 适用场景标签 */
  scenarios: ScenarioTag[] | string[];
  /** 是否默认启用 */
  enabledByDefault: boolean;
  /** 简短说明 */
  desc: string;
}

/** 各阶段标准化返回结构的宽基类型（供编排器统一吸收各阶段产物） */
export interface OpsStageResult {
  collectTaskIds?: number[];
  topicIds?: number[];
  scriptIds?: number[];
  publishTaskIds?: number[];
  recycleTaskIds?: number[];
  strategy?: string;
}

/** 统一策略接口：每个阶段策略都接受上下文 + 配置，返回标准化结果 */
export interface OpsStrategy<C = any, R = OpsStageResult> {
  meta: StrategyMeta;
  run(ctx: OpsChainContext, config: C): Promise<R>;
}

/** 全链路共享上下文（沿阶段透传，含之前运行产生的资产 id） */
export interface OpsChainContext {
  tenantId: string;
  /** 检索阶段产出的采集任务 id 列表 */
  collectTaskIds?: number[];
  /** 分析任务 id 列表 */
  analysisTaskIds?: number[];
  /** 筛选产出的选题 id 列表 */
  topicIds?: number[];
  /** 上架产出的脚本 id 列表 */
  scriptIds?: number[];
  /** 投流产出的发布任务 id 列表 */
  publishTaskIds?: number[];
  /** 验证产出的回收任务 id 列表 */
  recycleTaskIds?: number[];
  /** 透传归因（只读） */
  attributionId?: string;
  /** 链路级运行 id（用于日志追踪） */
  chainRunId?: string;
}

/** 各阶段标准化返回结构 */
export interface RetrieveResult {
  collectTaskIds: number[];
  platform: string;
}
export interface ScreenResult {
  topicIds: number[];
  chosen: number;
  strategy: string;
}
export interface PublishUpResult {
  scriptIds: number[];
  strategy: string;
}
export interface DeliverResult {
  publishTaskIds: number[];
  channels: string[];
}
export interface VerifyResult {
  recycleTaskIds: number[];
  ratedTopics: number;
  feedbacks: number;
  strategy: string;
}
