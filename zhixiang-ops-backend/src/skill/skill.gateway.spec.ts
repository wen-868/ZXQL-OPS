import { SkillGateway } from './skill.gateway';
import { SkillInvokePayload } from './skill.types';

// 隔离真实的网络调用：用桩替换租户自选 Provider，仅验证网关的候选顺序与降级逻辑
jest.mock('./providers/configured.provider', () => ({
  LlmConfiguredProvider: class {
    source = 'tenant-byo';
    supports = ['text-generate'];
    constructor(public cfg: any) {}
    generate = jest.fn(async () => ({
      content: 'cfg-content',
      modelUsed: this.cfg?.model ?? 'cfg-model',
      source: 'tenant-byo',
    }));
  },
}));

const makeProvider = (source: string) => ({
  source,
  supports: ['text-generate'],
  isEnabled: jest.fn(() => true),
  generate: jest.fn(async () => ({ content: `${source}-result`, modelUsed: 'm', source })),
});

const usageRepo = {
  create: jest.fn((e: any) => e),
  save: jest.fn(),
};

const skillCenter = {
  isEnabled: jest.fn(),
  resolveByoProvider: jest.fn(),
};

const llm: any = {
  listRoutingProviders: jest.fn(async () => []),
};

describe('SkillGateway', () => {
  let gateway: SkillGateway;
  let ollama: any;
  let gatewayProvider: any;

  beforeEach(async () => {
    ollama = makeProvider('local-ollama');
    gatewayProvider = makeProvider('external');
    jest.clearAllMocks();
    skillCenter.isEnabled.mockImplementation(async () => true);
    llm.listRoutingProviders.mockImplementation(async () => []);
    gateway = new SkillGateway(ollama, usageRepo as any, skillCenter as any, gatewayProvider, llm);
  });

  it('应成功调用第一个可用 Provider 并返回结果', async () => {
    const payload: SkillInvokePayload = { skill: 'text-generate', prompt: 'hi' };
    const r = await gateway.invoke(payload);
    expect(r.content).toBe('external-result');
    expect(gatewayProvider.generate).toHaveBeenCalledTimes(1);
    expect(ollama.generate).not.toHaveBeenCalled();
  });

  it('首个 Provider 失败时自动降级到本地 Ollama', async () => {
    gatewayProvider.generate.mockRejectedValueOnce(new Error('boom'));
    const payload: SkillInvokePayload = { skill: 'text-generate', prompt: 'hi' };
    const r = await gateway.invoke(payload);
    expect(r.content).toBe('local-ollama-result');
    expect(gatewayProvider.generate).toHaveBeenCalledTimes(1);
    expect(ollama.generate).toHaveBeenCalledTimes(1);
  });

  it('所有 Provider 失败时抛出 SKILL_UNAVAILABLE', async () => {
    gatewayProvider.generate.mockRejectedValue(new Error('e1'));
    ollama.generate.mockRejectedValue(new Error('e2'));
    const payload: SkillInvokePayload = { skill: 'text-generate', prompt: 'hi' };
    await expect(gateway.invoke(payload)).rejects.toMatchObject({ code: 'SKILL_UNAVAILABLE' });
  });

  it('启用门禁：未启用技能时抛 SKILL_NOT_ENABLED', async () => {
    skillCenter.isEnabled.mockImplementation(async () => false);
    const payload: SkillInvokePayload = { skill: 'text-generate', prompt: 'hi', tenantId: 't1' };
    await expect(gateway.invoke(payload)).rejects.toMatchObject({ code: 'SKILL_NOT_ENABLED' });
  });

  it('环境无外部网关时直接走本地 Ollama', async () => {
    gatewayProvider.isEnabled.mockReturnValue(false);
    const payload: SkillInvokePayload = { skill: 'text-generate', prompt: 'hi' };
    const r = await gateway.invoke(payload);
    expect(r.content).toBe('local-ollama-result');
    expect(ollama.generate).toHaveBeenCalledTimes(1);
  });

  it('客户在「大模型配置」中选的提供方优先于本地 Ollama（第三方优先）', async () => {
    gatewayProvider.isEnabled.mockReturnValue(false);
    llm.listRoutingProviders.mockImplementation(async () => [
      { type: 'openai', baseUrl: 'https://api.openai.com', apiKey: 'k', model: 'gpt-4' },
    ]);
    const payload: SkillInvokePayload = { skill: 'text-generate', prompt: 'hi', tenantId: 't1' };
    const r = await gateway.invoke(payload);
    expect(r.content).toBe('cfg-content');
    expect(r.source).toBe('tenant-byo');
    expect(llm.listRoutingProviders).toHaveBeenCalledWith('t1');
    expect(ollama.generate).not.toHaveBeenCalled();
  });

  it('无租户时不读取客户 LLM 配置（仅 env+本地 Ollama）', async () => {
    gatewayProvider.isEnabled.mockReturnValue(false);
    const payload: SkillInvokePayload = { skill: 'text-generate', prompt: 'hi' };
    const r = await gateway.invoke(payload);
    expect(r.content).toBe('local-ollama-result');
    expect(llm.listRoutingProviders).not.toHaveBeenCalled();
    expect(skillCenter.resolveByoProvider).not.toHaveBeenCalled();
  });

  it('租户绑定 BYO Provider 时优先于大模型配置与本地 Ollama 路由', async () => {
    gatewayProvider.isEnabled.mockReturnValue(false);
    const byoProvider = {
      source: 'tenant-byo' as const,
      supports: ['text-generate'],
      generate: jest.fn(async () => ({
        content: 'byo-result',
        modelUsed: 'my-model',
        source: 'tenant-byo' as const,
      })),
    };
    const spy = jest
      .spyOn(require('./providers/byo.provider'), 'ByoProvider')
      .mockImplementation(() => byoProvider as never);
    skillCenter.resolveByoProvider.mockImplementation(async () => ({
      provider: { name: 'my-byo', baseUrl: 'https://byo.example.com/v1', models: ['my-model'] },
      apiKey: 'sk-test',
    }));

    const payload: SkillInvokePayload = { skill: 'text-generate', prompt: 'hi', tenantId: 't1' };
    const r = await gateway.invoke(payload);

    expect(skillCenter.resolveByoProvider).toHaveBeenCalledWith('t1', 'text-generate');
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: 'https://byo.example.com/v1',
        apiKey: 'sk-test',
        model: 'my-model',
      }),
    );
    expect(byoProvider.generate).toHaveBeenCalledTimes(1);
    expect(r.content).toBe('byo-result');
    expect(r.source).toBe('tenant-byo');
    expect(ollama.generate).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('BYO 解析返回 null（未绑定）时行为不变（LLM 配置 → Ollama）', async () => {
    gatewayProvider.isEnabled.mockReturnValue(false);
    skillCenter.resolveByoProvider.mockImplementation(async () => null);
    const payload: SkillInvokePayload = { skill: 'text-generate', prompt: 'hi', tenantId: 't1' };
    const r = await gateway.invoke(payload);
    expect(r.content).toBe('local-ollama-result');
    expect(skillCenter.resolveByoProvider).toHaveBeenCalledWith('t1', 'text-generate');
  });
});
