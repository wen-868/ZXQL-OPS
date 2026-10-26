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

/** 外部 LLM 调用超时（防挂死；超时抛 TimeoutError，由 SkillGateway 重试/降级） */
export const LLM_CALL_TIMEOUT_MS = 60_000;

/** 取数值型参数：非 number 一律回退默认值（params 为外部传入，不做类型假设） */
export function numOr(value: unknown, fallback: number): number {
  return typeof value === 'number' ? value : fallback;
}

/** 取非空字符串参数：非 string 或空串一律回退默认值 */
export function nonEmptyStrOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && value ? value : fallback;
}

/** 网关类型 → 统一端点调用类型（网关仅三态，映射封闭无缺省分支） */
const LLM_CALL_TYPE: Record<LlmGatewayType, LlmCallType> = {
  ollama: 'ollama',
  openai: 'openai',
  zhipu: 'zhipu',
};

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
      signal: AbortSignal.timeout(LLM_CALL_TIMEOUT_MS),
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

/** Bearer 鉴权头（无 key 时返回空对象，便于展开） */
function authHeaders(apiKey?: string): Record<string, string> {
  return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
}

/** 取 chat 响应首条 message（结构防御性访问，任一缺失返回 undefined） */
function firstChatMessage(
  json: unknown,
): { content?: string; reasoning_content?: string } | undefined {
  const choices = (
    json as { choices?: Array<{ message?: { content?: string; reasoning_content?: string } }> }
  )?.choices;
  return choices?.[0]?.message;
}

/**
 * 从 chat 响应提取正文：优先 message.content；
 * 推理模型可能只把 token 花在 reasoning_content 上，故 content 为空时回退它。
 */
function extractChatContent(json: unknown): string {
  const msg = firstChatMessage(json);
  return msg?.content?.trim() || msg?.reasoning_content?.trim() || '';
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
        ...authHeaders(apiKey),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(LLM_CALL_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => '')}`);
    }
    const content = extractChatContent(await res.json());
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
    const temperature = numOr(params.temperature, 0.8);
    // 推理模型需要更多 token 预算（思维链占用），默认提升到 2048
    const maxTokens = numOr(params.maxTokens, 2048);
    const type = LLM_CALL_TYPE[this.runtimeType];
    // params.model 显式覆盖默认模型（调用方须自行做白名单/成本控制）
    const model = nonEmptyStrOr(params.model, this.runtimeModel);
    return callLlmEndpoint({
      baseUrl: this.runtimeBase,
      apiKey: this.runtimeApiKey,
      model,
      type,
      prompt: payload.prompt,
      temperature,
      maxTokens,
    });
  }
}
