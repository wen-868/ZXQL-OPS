/**
 * 能力网关（Skill Gateway）类型定义（规划 §4-O / §14）。
 * 统一入口：invoke(skill, payload) → { content, modelUsed, source }。
 * 源对 UX 透明：modelUsed 仅内部记录，不向用户标注本地/外部。
 */

/** 技能类型：与 Z 技能中心 5 类内置技能对齐 */
export type SkillType =
  'text-generate' | 'image-generate' | 'video-generate' | 'voice-clone' | 'digital-human';

/** Provider 来源标识（仅内部记录，对 UX 透明） */
export type SkillSource = 'local-ollama' | 'external' | 'tenant-byo';

/** 一次能力调用的返回 */
export interface SkillResult {
  /** 生成内容（文本/图片URL/视频URL 等，按技能类型而定） */
  content: string;
  /** 实际使用的模型名（内部记录，不向用户暴露来源） */
  modelUsed: string;
  /** 来源（内部计费/降级用） */
  source: SkillSource;
}

/** 调用载荷 */
export interface SkillInvokePayload {
  skill: SkillType;
  /** 主提示词（text/image/video 通用） */
  prompt: string;
  /** 可选参数（temperature/maxTokens/负面提示词等） */
  params?: Record<string, unknown>;
  /** 租户（BYO Provider 按 tenant 读取，usage 计费隔离） */
  tenantId?: string;
}

/**
 * Provider 抽象：统一 generate 入口。
 * 实现：OllamaProvider（本地默认）/ 外部 Provider / 租户 BYO Provider。
 */
export interface SkillProvider {
  readonly source: SkillSource;
  /** 该 provider 支持的技能类型 */
  readonly supports: SkillType[];
  generate(payload: SkillInvokePayload): Promise<SkillResult>;
}
