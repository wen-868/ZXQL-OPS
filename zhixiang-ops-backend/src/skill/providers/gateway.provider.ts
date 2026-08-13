import { Logger } from '@nestjs/common';
import { env } from '../../config/env';
import {
  SkillInvokePayload,
  SkillProvider,
  SkillResult,
  SkillSource,
  SkillType,
} from '../skill.types';
import { AppError } from '../../shared/app-error';

export type LlmGatewayType = 'ollama' | 'openai' | 'zhipu';

/** 客户「大模型配置」可选类型（与 ops_llm_providers.type 对齐） */
export type LlmCallType = 'ollama' | 'openai' | 'azure' | 'custom' | 'zhipu';

/** 统一的 LLM 端点调用（供外部网关与租户自建 Provider 复用） */
export async function callLlmEndpoint(opts: {
  baseUrl: string;
  apiKey?: string;
  model: string;
  type: LlmCallType;
  prompt: string;
  temperature: number;
  maxTokens: number;
}): Promise<SkillResult> {
  const base = opts.baseUrl.replace(/\/+$/, '');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.apiKey) headers['Authorization'] = `Bearer ${opts.apiKey}`;

  switch (opts.type) {
    case 'ollama':
      return callOllama(
        `${base}/api/generate`,
        opts.apiKey,
        opts.model,
        opts.prompt,
        opts.temperature,
        opts.maxTokens,
      );
    case 'openai':
      return chatCompatible(
        `${base}/v1/chat/completions`,
        opts.apiKey,
        opts.model,
        opts.prompt,
        opts.temperature,
        opts.maxTokens,
      );
    case 'custom':
      return chatCompatible(
        `${base}/chat/completions`,
        opts.apiKey,
        opts.model,
        opts.prompt,
        opts.temperature,
        opts.maxTokens,
      );
    case 'azure':
      // Azure：baseUrl 已是完整 deployments 路径（含 api-version 查询参数），直接作为请求地址
      return chatCompatible(
        base,
        opts.apiKey,
        opts.model,
        opts.prompt,
        opts.temperature,
        opts.maxTokens,
      );
    case 'zhipu':
      return chatCompatible(
        `${base}/chat/completions`,
        opts.apiKey,
        opts.model,
        opts.prompt,
        opts.temperature,
        opts.maxTokens,
      );
  }
}

async function callOllama(
  url: string,
  apiKey: string | undefined,
  model: string,
  prompt: string,
  temperature: number,
  maxTokens: number,
): Promise<SkillResult> {
  const body = {
    model,
    prompt,
    stream: false,
    options: { temperature, num_predict: maxTokens },
  };
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`Ollama HTTP ${res.status}: ${await res.text().catch(() => '')}`);
    }
    const json = (await res.json()) as { response?: string };
    return { content: json.response ?? '', modelUsed: model, source: 'local-ollama' };
  } catch (err) {
    throw new Error(
      `Ollama 调用失败 (${Date.now() - started}ms): ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

async function chatCompatible(
  url: string,
  apiKey: string | undefined,
  model: string,
  prompt: string,
  temperature: number,
  maxTokens: number,
): Promise<SkillResult> {
  const body = {
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature,
    max_tokens: maxTokens,
    stream: false,
  };
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => '')}`);
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string; reasoning_content?: string } }[];
    };
    const msg = json.choices?.[0]?.message ?? {};
    // 部分推理模型会把 token 消耗在 reasoning_content 上，content 可能为空，
    // 此时回退到 reasoning_content 作为兜底内容，避免前端拿到空串。
    const content = msg.content?.trim() || msg.reasoning_content?.trim() || '';
    return { content, modelUsed: model, source: 'external' };
  } catch (err) {
    throw new Error(
      `Chat 调用失败 (${Date.now() - started}ms): ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** 智谱AI 内置默认端点与模型（免费、优先于本地 Ollama，避免本机未装 Ollama 导致 AI 不可用） */
const ZHIPU_DEFAULT_BASE = 'https://open.bigmodel.cn/api/paas/v4';
const ZHIPU_DEFAULT_MODEL = 'glm-4.7-flash';

/**
 * 外部 LLM 网关 Provider（规划 §14 阶段3 外部/BYO 接入）。
 * 通过 OPS_LLM_GATEWAY 配置远端 base URL，支持两类兼容协议：
 *  - ollama：远端兼容 Ollama /api/generate（如托管 Ollama、OpenRouter Ollama 模式等）
 *  - openai：远端兼容 OpenAI /v1/chat/completions（如各类 OpenAI 兼容端点）
 * 可选 OPS_LLM_GATEWAY_KEY 作为 Bearer 鉴权。
 * 仅在 OPS_LLM_GATEWAY 非空时由 SkillGateway 启用为首选（全局覆盖），失败后降级到客户配置/本地 Ollama。
 */
export class GatewayProvider implements SkillProvider {
  readonly source: SkillSource = 'external';
  readonly supports: SkillType[] = ['text-generate'];
  private readonly logger = new Logger(GatewayProvider.name);

  /** 外部网关显式 base URL（OPS_LLM_GATEWAY），空则走智能回退 */
  private readonly explicitBase = env.OPS_LLM_GATEWAY.trim().replace(/\/$/, '');
  private readonly explicitType: LlmGatewayType =
    (env.OPS_LLM_GATEWAY_TYPE as LlmGatewayType) || 'ollama';
  /** 智谱 API Key（注册获取免费额度） */
  private readonly zhipuKey = env.OPS_LLM_GATEWAY_KEY.trim();

  // 智能回退：未配显式网关但有智谱 Key → 自动启用智谱免费端点
  private readonly useZhipuFallback = !this.explicitBase && this.zhipuKey.length > 0;
  private readonly enabled = this.explicitBase.length > 0 || this.useZhipuFallback;

  /** 运行时生效的 base / type / model / apiKey */
  private get runtimeBase(): string {
    return this.explicitBase || ZHIPU_DEFAULT_BASE;
  }
  private get runtimeType(): LlmGatewayType {
    if (this.useZhipuFallback) return 'zhipu';
    return this.explicitType;
  }
  private get runtimeModel(): string {
    if (this.useZhipuFallback) return ZHIPU_DEFAULT_MODEL;
    return env.OPS_OLLAMA_MODEL;
  }
  private get runtimeApiKey(): string {
    if (this.useZhipuFallback) return this.zhipuKey;
    return env.OPS_LLM_GATEWAY_KEY;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async generate(payload: SkillInvokePayload): Promise<SkillResult> {
    if (!this.enabled) {
      throw new AppError('SKILL_UNAVAILABLE', '外部 LLM 网关未配置 (OPS_LLM_GATEWAY) 且无智谱 Key');
    }
    if (!this.supports.includes(payload.skill)) {
      throw new AppError('SKILL_UNSUPPORTED', `Gateway Provider 不支持技能: ${payload.skill}`);
    }
    const params = payload.params ?? {};
    const temperature = typeof params.temperature === 'number' ? params.temperature : 0.8;
    // 推理模型需要更多 token 预算（思维链占用），默认提升到 2048
    const maxTokens = typeof params.maxTokens === 'number' ? params.maxTokens : 2048;

    const type: LlmCallType =
      this.runtimeType === 'zhipu' ? 'zhipu' : this.runtimeType === 'openai' ? 'openai' : 'ollama';
    return callLlmEndpoint({
      baseUrl: this.runtimeBase,
      apiKey: this.runtimeApiKey,
      model: this.runtimeModel,
      type,
      prompt: payload.prompt,
      temperature,
      maxTokens,
    });
  }
}
