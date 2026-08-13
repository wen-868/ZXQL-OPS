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
    const params = payload.params ?? {};
    const body = {
      model: this.model,
      prompt: payload.prompt,
      stream: false,
      options: {
        temperature: typeof params.temperature === 'number' ? params.temperature : 0.8,
        num_predict: typeof params.maxTokens === 'number' ? params.maxTokens : 1024,
      },
    };
    const started = Date.now();
    try {
      const res = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Ollama 调用失败: ${message}`);
      throw err;
    }
  }
}
