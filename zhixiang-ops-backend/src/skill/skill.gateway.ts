import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppError } from '../shared/app-error';
import { SkillInvokePayload, SkillProvider, SkillResult } from './skill.types';
import { OllamaProvider } from './providers/ollama.provider';
import { GatewayProvider } from './providers/gateway.provider';
import { ByoProvider } from './providers/byo.provider';
import { SkillUsageLog } from './skill-usage-log.entity';
import { SkillCenterService } from '../modules/skill-center/skill-center.service';
import { LlmProviderService } from '../modules/llm/llm.service';
import { LlmConfiguredProvider } from './providers/configured.provider';

/**
 * 能力网关（Skill Gateway，规划 §4-O / §14）。
 * - 路由：按技能类型选可用 Provider（当前默认 local-ollama，支持 text-generate）。
 * - 降级：某 Provider 失败自动尝试下一个；全部失败抛 SKILL_UNAVAILABLE（可重试）。
 * - 源透明：modelUsed 仅内部记录，不向 UX 暴露本地/外部。
 * - 启用门禁：调用前经 Z 技能中心校验租户是否启用该技能（未启用不在系统暴露）。
 * - 用量：每次调用 best-effort 写入 skill_usage_logs（失败不阻塞主链路）。
 */
@Injectable()
export class SkillGateway {
  private readonly logger = new Logger(SkillGateway.name);

  constructor(
    private readonly ollama: OllamaProvider,
    @InjectRepository(SkillUsageLog)
    private readonly usageRepo: Repository<SkillUsageLog>,
    private readonly skillCenter: SkillCenterService,
    private readonly gateway: GatewayProvider,
    private readonly llm: LlmProviderService,
  ) {}

  async invoke(payload: SkillInvokePayload): Promise<SkillResult> {
    // 启用门禁：有租户上下文时校验是否启用该技能（未启用则不在智享全链运营系统暴露）
    if (payload.tenantId) {
      const enabled = await this.skillCenter.isEnabled(payload.tenantId, payload.skill);
      if (!enabled) {
        throw new AppError('SKILL_NOT_ENABLED', `该租户未启用技能: ${payload.skill}`);
      }
    }

    // 注册表候选顺序（第三方优先，本地 Ollama 兜底）：
    //  1) 全局外部网关（OPS_LLM_GATEWAY 配置 / 智谱 Key）——最高优先级覆盖
    //  2) 客户在「大模型配置」中自选的提供方（第三方类型优先于 Ollama）
    //  3) 本地 Ollama —— 最终兜底
    const candidates: SkillProvider[] = [];
    if (this.gateway?.isEnabled()) {
      candidates.push(this.gateway);
    }
    if (payload.tenantId) {
      try {
        const byo = await this.skillCenter.resolveByoProvider(payload.tenantId, payload.skill);
        if (byo) {
          candidates.push(
            new ByoProvider({
              baseUrl: byo.provider.baseUrl ?? '',
              apiKey: byo.apiKey,
              model: byo.provider.models?.[0] ?? 'default',
              skill: payload.skill,
              name: byo.provider.name,
            }),
          );
        }
      } catch (err) {
        this.logger.warn(`读取租户 BYO Provider 失败: ${(err as Error).message}`);
      }
      try {
        const configured = await this.llm.listRoutingProviders(payload.tenantId);
        for (const c of configured) {
          candidates.push(new LlmConfiguredProvider(c));
        }
      } catch (err) {
        this.logger.warn(`读取租户 LLM 配置失败，降级到本地 Ollama: ${(err as Error).message}`);
      }
    }
    candidates.push(this.ollama);
    const matched = candidates.filter((p) => p.supports.includes(payload.skill));
    if (matched.length === 0) {
      throw new AppError('SKILL_UNSUPPORTED', `无可用 Provider 支持技能: ${payload.skill}`);
    }

    let lastErr: unknown;
    for (const provider of matched) {
      const started = Date.now();
      try {
        const result = await provider.generate(payload);
        await this.logUsage(payload, result, Date.now() - started, true);
        return result;
      } catch (err) {
        lastErr = err;
        this.logger.warn(`Provider[${provider.source}] 失败，尝试降级: ${(err as Error).message}`);
      }
    }

    await this.logUsage(payload, null, 0, false);
    throw new AppError('SKILL_UNAVAILABLE', '所有 Provider 均不可用，请稍后重试', {
      lastError: lastErr instanceof Error ? lastErr.message : String(lastErr),
    });
  }

  /** 供 B/C/D/E/F/I 等模块复用的便捷文本生成 */
  async generateText(
    prompt: string,
    tenantId?: string,
    params?: Record<string, unknown>,
  ): Promise<string> {
    const r = await this.invoke({ skill: 'text-generate', prompt, params, tenantId });
    return r.content;
  }

  private async logUsage(
    payload: SkillInvokePayload,
    result: SkillResult | null,
    latencyMs: number,
    ok: boolean,
  ): Promise<void> {
    const log = this.usageRepo.create({
      tenantId: payload.tenantId ?? 'system',
      skill: payload.skill,
      source: result?.source ?? 'unknown',
      modelUsed: result?.modelUsed ?? '',
      tokens: 0,
      latencyMs,
      ok,
    });
    await this.usageRepo.save(log);
  }
}
