import { LlmProviderService } from './llm.service';
import { LlmProviderEntity } from './llm-provider.entity';
import { encryptSecret, decryptSecret } from '../../shared/crypto';

const makeRepo = () => ({
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  softRemove: jest.fn(),
});

describe('LlmProviderService', () => {
  it('apiKey 加密存储且可解密', () => {
    const enc = encryptSecret('sk-test');
    expect(enc).not.toContain('sk-test');
    expect(decryptSecret(enc)).toBe('sk-test');
  });

  it('create 重名抛 LLM_PROVIDER_NAME_DUP', async () => {
    const repo = makeRepo() as any;
    repo.findOne.mockResolvedValue({ id: 1, name: '本地Ollama' });
    const svc = new LlmProviderService(repo);
    await expect(
      svc.create({ name: '本地Ollama', type: 'ollama', apiKey: 'k' }, 't1'),
    ).rejects.toMatchObject({ code: 'LLM_PROVIDER_NAME_DUP' });
  });

  it('create 成功加密 apiKey 并返回掩码', async () => {
    const repo = makeRepo() as any;
    repo.findOne.mockResolvedValue(null);
    repo.save.mockImplementation(async (e: LlmProviderEntity) => ({ ...e, id: 2 }));
    const svc = new LlmProviderService(repo);
    const v = await svc.create(
      {
        name: 'P1',
        type: 'openai',
        baseUrl: 'http://x',
        apiKey: 'secret',
        defaultModel: 'gpt',
        enabled: true,
        remark: 'r',
      },
      't1',
    );
    const saved = repo.save.mock.calls[0][0];
    expect(decryptSecret(saved.apiKeyEnc)).toBe('secret');
    expect(v.apiKeyMasked).toBe('******');
  });

  it('update 不传 apiKey 时不改动加密串', async () => {
    const repo = makeRepo() as any;
    repo.findOne.mockResolvedValue({
      id: 3,
      tenantId: 't1',
      name: 'P',
      type: 'ollama',
      apiKeyEnc: 'old',
      enabled: 1,
    });
    repo.save.mockImplementation(async (e: any) => ({ ...e }));
    const svc = new LlmProviderService(repo);
    const v = await svc.update(3, { baseUrl: 'http://y' }, 't1');
    expect(repo.save.mock.calls[0][0].apiKeyEnc).toBe('old');
    expect(v.baseUrl).toBe('http://y');
  });

  it('detail 找不到抛 LLM_PROVIDER_NOT_FOUND', async () => {
    const repo = makeRepo() as any;
    repo.findOne.mockResolvedValue(null);
    const svc = new LlmProviderService(repo);
    await expect(svc.detail(99, 't1')).rejects.toMatchObject({ code: 'LLM_PROVIDER_NOT_FOUND' });
  });

  it('listRoutingProviders：仅启用且齐备端点、第三方优先排序、解密 apiKey', async () => {
    const repo = makeRepo() as any;
    repo.find.mockResolvedValue([
      {
        tenantId: 't1',
        enabled: 1,
        type: 'ollama',
        baseUrl: 'http://o',
        defaultModel: 'q',
        apiKeyEnc: '',
      },
      {
        tenantId: 't1',
        enabled: 1,
        type: 'openai',
        baseUrl: 'http://oa',
        defaultModel: 'gpt',
        apiKeyEnc: encryptSecret('k1'),
      },
      // 模拟 DB WHERE enabled=1：禁用项不会返回（此处不再放入）
      {
        tenantId: 't1',
        enabled: 1,
        type: 'custom',
        baseUrl: 'http://c',
        defaultModel: '',
        apiKeyEnc: '',
      },
    ]);
    const svc = new LlmProviderService(repo);
    const list = await svc.listRoutingProviders('t1');
    expect(list.map((p) => p.type)).toEqual(['openai', 'ollama']);
    expect(list[0].apiKey).toBe('k1');
    expect(list[1].apiKey).toBeUndefined();
  });
});
