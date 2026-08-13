import { SkillInvokePayload, SkillProvider, SkillResult, SkillType } from '../skill.types';

/**
 * 租户 BYO Provider（source=tenant-byo/external，OpenAI 兼容接口）。
 * 技能中心 skill_installs.provider_id 绑定后由 SkillGateway 放入路由候选，
 * 实现「看得见且生效」的 BYO 语义（规划 §4-O / Z 技能中心）。
 */
export class ByoProvider implements SkillProvider {
  readonly source = 'tenant-byo' as const;
  readonly supports: SkillType[];

  constructor(
    private readonly cfg: {
      baseUrl: string;
      apiKey: string;
      model: string;
      skill: SkillType;
      name: string;
    },
  ) {
    this.supports = [cfg.skill];
  }

  async generate(payload: SkillInvokePayload): Promise<SkillResult> {
    const url = `${this.cfg.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: this.cfg.model,
        messages: [
          {
            role: 'user',
            content: payload.prompt,
          },
        ],
        ...payload.params,
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`BYO Provider HTTP ${resp.status}: ${text.slice(0, 200)}`);
    }
    const json = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error(`BYO Provider 返回为空: ${this.cfg.name}`);
    }
    return { content, modelUsed: this.cfg.model, source: this.source };
  }
}
