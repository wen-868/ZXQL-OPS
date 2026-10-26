import { callLlmEndpoint, GatewayProvider } from './gateway.provider';
import { ByoProvider } from './byo.provider';
import { LlmConfiguredProvider } from './configured.provider';
import { SkillInvokePayload } from '../skill.types';
import { AppError } from '../../shared/app-error';

/**
 * 外部 LLM 端点与租户 Provider 单元测试：mock 全局 fetch 隔离真实网络。
 * 覆盖 callLlmEndpoint 的 ollama/openai/azure/custom/zhipu 分支与错误路径，
 * 以及 ByoProvider / LlmConfiguredProvider 的封装行为。
 */
describe('callLlmEndpoint（统一端点）', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const okJson = (content: string, reasoning?: string) => ({
    ok: true,
    json: async () => ({
      choices: [{ message: { content, ...(reasoning ? { reasoning_content: reasoning } : {}) } }],
    }),
  });

  it('ollama 类型走 /api/generate', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ response: 'ollama-out' }),
    });
    const r = await callLlmEndpoint({
      baseUrl: 'http://localhost:11434/',
      model: 'qwen',
      type: 'ollama',
      prompt: 'p',
      temperature: 0.7,
      maxTokens: 256,
    });
    expect(r.content).toBe('ollama-out');
    expect(r.source).toBe('local-ollama');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/generate');
  });

  it('openai 类型走 /v1/chat/completions 且带 Bearer', async () => {
    fetchMock.mockResolvedValueOnce(okJson('openai-out'));
    const r = await callLlmEndpoint({
      baseUrl: 'https://api.openai.com',
      apiKey: 'sk-x',
      model: 'gpt-4',
      type: 'openai',
      prompt: 'p',
      temperature: 0.5,
      maxTokens: 128,
    });
    expect(r.content).toBe('openai-out');
    expect(r.source).toBe('external');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-x');
  });

  it('content 为空时回退 reasoning_content（推理模型兜底）', async () => {
    fetchMock.mockResolvedValueOnce(okJson('', 'chain-of-thought'));
    const r = await callLlmEndpoint({
      baseUrl: 'https://api.example.com',
      model: 'r1',
      type: 'zhipu',
      prompt: 'p',
      temperature: 0.8,
      maxTokens: 2048,
    });
    expect(r.content).toBe('chain-of-thought');
  });

  it('azure 类型直接使用 baseUrl 作为请求地址', async () => {
    fetchMock.mockResolvedValueOnce(okJson('azure-out'));
    const r = await callLlmEndpoint({
      baseUrl:
        'https://azure.openai.azure.com/openai/deployments/gpt4/chat/completions?api-version=2024-02-01',
      apiKey: 'az-key',
      model: 'gpt4',
      type: 'azure',
      prompt: 'p',
      temperature: 0.5,
      maxTokens: 128,
    });
    expect(r.content).toBe('azure-out');
    expect(String(fetchMock.mock.calls[0][0])).toContain('api-version=2024-02-01');
  });

  it('custom 类型走 /chat/completions', async () => {
    fetchMock.mockResolvedValueOnce(okJson('custom-out'));
    const r = await callLlmEndpoint({
      baseUrl: 'http://self-host:8080',
      model: 'm',
      type: 'custom',
      prompt: 'p',
      temperature: 0.5,
      maxTokens: 128,
    });
    expect(r.content).toBe('custom-out');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/chat/completions');
  });

  it('HTTP 错误抛出带状态码的错误', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'unauthorized',
    });
    await expect(
      callLlmEndpoint({
        baseUrl: 'https://api.example.com',
        model: 'm',
        type: 'openai',
        prompt: 'p',
        temperature: 0.5,
        maxTokens: 128,
      }),
    ).rejects.toThrow(/HTTP 401/);
  });

  it('请求携带超时信号（AbortSignal.timeout）', async () => {
    fetchMock.mockResolvedValueOnce(okJson('ok'));
    await callLlmEndpoint({
      baseUrl: 'https://api.example.com',
      model: 'm',
      type: 'openai',
      prompt: 'p',
      temperature: 0.5,
      maxTokens: 128,
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeDefined();
    expect(init.signal?.aborted).toBe(false);
  });
});

describe('GatewayProvider', () => {
  it('未配置网关且无智谱 Key 时 isEnabled=false，generate 抛 SKILL_UNAVAILABLE', async () => {
    const p = new GatewayProvider();
    if (p.isEnabled()) {
      // 本机若配了 OPS_LLM_GATEWAY/OPS_LLM_GATEWAY_KEY 则跳过该断言
      return;
    }
    await expect(p.generate({ skill: 'text-generate', prompt: 'hi' })).rejects.toMatchObject({
      code: 'SKILL_UNAVAILABLE',
    });
  });

  it('不支持技能类型抛 SKILL_UNSUPPORTED', async () => {
    const p = new GatewayProvider();
    if (!p.isEnabled()) return;
    await expect(p.generate({ skill: 'video-generate', prompt: 'x' })).rejects.toMatchObject({
      code: 'SKILL_UNSUPPORTED',
    });
  });
});

describe('ByoProvider', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const payload: SkillInvokePayload = { skill: 'text-generate', prompt: 'hi' };

  it('generate 成功返回内容（OpenAI 兼容 /chat/completions）', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'byo-out' } }] }),
    });
    const p = new ByoProvider({
      baseUrl: 'https://byo.example.com/v1/',
      apiKey: 'sk-test',
      model: 'my-model',
      skill: 'text-generate',
      name: 'my-byo',
    });
    const r = await p.generate(payload);
    expect(r.content).toBe('byo-out');
    expect(r.modelUsed).toBe('my-model');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://byo.example.com/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test');
    expect(init.signal).toBeDefined();
  });

  it('HTTP 非 2xx 抛错', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => 'forbidden',
    });
    const p = new ByoProvider({
      baseUrl: 'https://byo.example.com',
      apiKey: 'k',
      model: 'm',
      skill: 'text-generate',
      name: 'n',
    });
    await expect(p.generate(payload)).rejects.toThrow(/HTTP 403/);
  });

  it('返回空内容抛错', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [] }),
    });
    const p = new ByoProvider({
      baseUrl: 'https://byo.example.com',
      apiKey: 'k',
      model: 'm',
      skill: 'text-generate',
      name: 'n',
    });
    await expect(p.generate(payload)).rejects.toThrow(/返回为空/);
  });
});

describe('LlmConfiguredProvider', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('generate 按租户配置转发（含 temperature/maxTokens 透传）', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'cfg-out' } }] }),
    });
    const p = new LlmConfiguredProvider({
      type: 'openai',
      baseUrl: 'https://api.example.com',
      apiKey: 'k',
      model: 'gpt-4o',
    });
    const r = await p.generate({
      skill: 'text-generate',
      prompt: 'hi',
      params: { temperature: 0.3, maxTokens: 256 },
    });
    expect(r.content).toBe('cfg-out');
    expect(r.source).toBe('external');
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body as string)) as { model: string; max_tokens: number };
    expect(body.model).toBe('gpt-4o');
    expect(body.max_tokens).toBe(256);
  });

  it('不支持技能类型抛 SKILL_UNSUPPORTED', async () => {
    const p = new LlmConfiguredProvider({
      type: 'openai',
      baseUrl: 'https://api.example.com',
      model: 'm',
    });
    await expect(p.generate({ skill: 'image-generate', prompt: 'x' })).rejects.toMatchObject({
      code: 'SKILL_UNSUPPORTED',
    });
  });

  it('AppError 导入回归保护', () => {
    expect(AppError).toBeDefined();
  });
});
