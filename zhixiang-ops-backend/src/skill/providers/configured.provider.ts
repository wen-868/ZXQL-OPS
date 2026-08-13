import {
  SkillInvokePayload,
  SkillProvider,
  SkillResult,
  SkillSource,
  SkillType,
} from '../skill.types';
import { AppError } from '../../shared/app-error';
import { LlmProviderType } from '../../modules/llm/llm-provider.entity';
import { callLlmEndpoint, LlmCallType } from './gateway.provider';

export interface LlmRoutingProvider {
  type: LlmProviderType;
  baseUrl: string;
  apiKey?: string;
  model: string;
}

/**
 * 租户「大模型配置」自选 Provider。
 * 客户在 ops_llm_providers 中配置的提供方（Ollama/OpenAI/Azure/自建），由 SkillGateway 注入为候选，
 * 第三方（外部）类型优先于本地 Ollama。本类仅负责按配置发起真实 HTTP 调用，不持有任何硬编码端点。
 */
export class LlmConfiguredProvider implements SkillProvider {
  readonly source: SkillSource = 'tenant-byo';
  readonly supports: SkillType[] = ['text-generate'];

  constructor(private readonly cfg: LlmRoutingProvider) {}

  async generate(payload: SkillInvokePayload): Promise<SkillResult> {
    if (!this.supports.includes(payload.skill)) {
      throw new AppError('SKILL_UNSUPPORTED', `Configured Provider 不支持技能: ${payload.skill}`);
    }
    const params = payload.params ?? {};
    const temperature = typeof params.temperature === 'number' ? params.temperature : 0.8;
    const maxTokens = typeof params.maxTokens === 'number' ? params.maxTokens : 1024;

    const type = this.cfg.type as LlmCallType;
    return callLlmEndpoint({
      baseUrl: this.cfg.baseUrl,
      apiKey: this.cfg.apiKey,
      model: this.cfg.model,
      type,
      prompt: payload.prompt,
      temperature,
      maxTokens,
    });
  }
}
