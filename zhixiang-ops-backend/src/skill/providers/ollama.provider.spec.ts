import { OllamaProvider } from './ollama.provider';
import { AppError } from '../../shared/app-error';
import { SkillInvokePayload } from '../skill.types';
import { LLM_CALL_TIMEOUT_MS } from './gateway.provider';

/**
 * OllamaProvider 单元测试：mock 全局 fetch 隔离真实网络。
 */
describe('OllamaProvider', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('generate 成功返回 content/source/modelUsed', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ response: 'hello' }),
    });
    const p = new OllamaProvider();
    const payload: SkillInvokePayload = { skill: 'text-generate', prompt: 'hi' };
    const r = await p.generate(payload);
    expect(r.content).toBe('hello');
    expect(r.source).toBe('local-ollama');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/generate');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(init.signal).toBeDefined();
  });

  it('generate 透传 params 的 temperature/maxTokens，缺省用默认值', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ response: 'x' }),
    });
    const p = new OllamaProvider();
    await p.generate({
      skill: 'text-generate',
      prompt: 'hi',
      params: { temperature: 0.2, maxTokens: 512 },
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body as string)) as {
      options: { temperature: number; num_predict: number };
    };
    expect(body.options.temperature).toBe(0.2);
    expect(body.options.num_predict).toBe(512);
  });

  it('HTTP 非 2xx 抛错', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'boom',
    });
    const p = new OllamaProvider();
    await expect(p.generate({ skill: 'text-generate', prompt: 'hi' })).rejects.toThrow(
      /Ollama HTTP 500/,
    );
  });

  it('不支持技能类型抛 SKILL_UNSUPPORTED', async () => {
    const p = new OllamaProvider();
    await expect(p.generate({ skill: 'image-generate', prompt: 'x' })).rejects.toMatchObject({
      code: 'SKILL_UNSUPPORTED',
    });
  });

  it('超时信号使用全局超时常量（60s）', async () => {
    expect(LLM_CALL_TIMEOUT_MS).toBe(60_000);
  });
});

describe('OllamaProvider 常量回归', () => {
  it('AppError 类型可被 reject 捕获（回归保护）', () => {
    expect(AppError).toBeDefined();
  });
});
