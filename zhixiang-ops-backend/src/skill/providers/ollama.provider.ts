import { Logger } from '@nestjs/common';
import { env } from '../../config/env';
import { LLM_CALL_TIMEOUT_MS } from './gateway.provider';
import {
  SkillInvokePayload,
  SkillProvider,
  SkillResult,
  SkillSource,
  SkillType,
} from '../skill.types';
import { AppError } from '../../shared/app-error';
import { numOr } from './gateway.provider';

/** 缺省采样温度 / 最大生成 token 数（params 未显式指定时使用） */
const DEFAULT_TEMPERATURE = 0.8;
const DEFAULT_MAX_TOKENS = 1024;

/** Ollama /api/generate 请求体（num_predict 为 Ollama 原生字段名，非 OpenAI 的 max_tokens） */
function buildBody(
  model: string,
  prompt: string,
  params: Record<string, unknown>,
): Record<string, unknown> {
  return {
    model,
    prompt,
    stream: false,
    options: {
      temperature: numOr(params.temperature, DEFAULT_TEMPERATURE),
      num_predict: numOr(params.maxTokens, DEFAULT_MAX_TOKENS),
    },
  };
}

/** 统一记日志并原样抛出（保留原始错误类型，便于上层按错误码/超时分类处理） */
function logAndRethrow(logger: Logger, prefix: string, err: unknown): never {
  const message = err instanceof Error ? err.message : String(err);
  logger.warn(`${prefix}: ${message}`);
  throw err;
}

/**
 * 本地 Ollama Provider（默认 text-generate 实现）。
 * 走 http://host:port/api/generate（Ollama 原生接口），不强制外部网络。
 * 其他技能类型（image/video/voice/digital-human）阶段3 经第三方渲染服务，
 * 本 Provider 暂不支持，调用即抛 SKILL_UNSUPPORTED。
 */
export class OllamaProvider implements SkillProvider {
  readonly source: SkillSource = 'local-ollama';
  readonly supports: SkillType[] = ['text-generate'];
  private readonly logger = new Logger(OllamaProvider.name);
  private readonly baseUrl = `http://${env.OPS_OLLAMA_HOST}:${env.OPS_OLLAMA_PORT}`;
  private readonly model = env.OPS_OLLAMA_MODEL;

  async generate(payload: SkillInvokePayload): Promise<SkillResult> {
    if (!this.supports.includes(payload.skill)) {
      throw new AppError('SKILL_UNSUPPORTED', `Ollama Provider 不支持技能: ${payload.skill}`);
    }
    const body = buildBody(this.model, payload.prompt, payload.params ?? {});
    const started = Date.now();
    return this.callApi(body, started);
  }

  /** 发起 /api/generate 请求并归一化结果（成功记耗时，失败记告警后原样抛出） */
  private async callApi(body: ReturnType<typeof buildBody>, started: number) {
    try {
      const res = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(LLM_CALL_TIMEOUT_MS),
      });
      if (!res.ok) {
        throw new Error(`Ollama HTTP ${res.status}: ${await res.text().catch(() => '')}`);
      }
      const json = (await res.json()) as { response?: string };
      this.logger.log(`Ollama 生成完成 (${Date.now() - started}ms, model=${this.model})`);
      return {
        content: json.response ?? '',
        modelUsed: this.model,
        source: this.source,
      };
    } catch (err) {
      logAndRethrow(this.logger, 'Ollama 调用失败', err);
    }
  }
}
