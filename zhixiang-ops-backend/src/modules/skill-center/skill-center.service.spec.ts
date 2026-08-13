import { SkillCenterService } from './skill-center.service';
import { SkillCatalog } from './skill-catalog.entity';
import { SkillInstall } from './skill-install.entity';

function repoMock<T extends { id?: number }>(seed: T[] = []) {
  let seq = seed.length;
  const store = [...seed];
  return {
    store,
    create: jest.fn((d) => ({ ...d })),
    save: jest.fn(async (e: any) => {
      if (e.id == null) e.id = ++seq;
      const i = store.findIndex((s) => s.id === e.id);
      if (i >= 0) store[i] = { ...store[i], ...e };
      else store.push(e);
      return e;
    }),
    find: jest.fn(async (arg?: any) => {
      const where = arg?.where ? (Array.isArray(arg.where) ? arg.where : [arg.where]) : null;
      return store.filter((s) => {
        if ((s as any).deletedAt) return false;
        if (!where) return true;
        return where.some((w: any) => Object.entries(w).every(([k, v]) => (s as any)[k] === v));
      });
    }),
    findOne: jest.fn(async (arg: any) => {
      const where = arg?.where ?? arg;
      const list = Array.isArray(where) ? where : [where];
      return (
        store.find((s) => {
          return list.some((w: any) => Object.entries(w).every(([k, v]) => (s as any)[k] === v));
        }) ?? null
      );
    }),
    count: jest.fn(async () => store.length),
    softDelete: jest.fn(async (arg: any) => {
      const list = Array.isArray(arg) ? arg : [arg];
      const hit = store.find((s) =>
        list.some((w: any) => Object.entries(w).every(([k, v]) => (s as any)[k] === v)),
      );
      if (hit) (hit as any).deletedAt = new Date();
      return { affected: hit ? 1 : 0 };
    }),
  };
}

describe('SkillCenterService', () => {
  let svc: SkillCenterService;
  let skillRepo: any;
  let installRepo: any;
  let providerRepo: any;
  let audit: any;

  beforeEach(() => {
    skillRepo = repoMock<SkillCatalog>();
    installRepo = repoMock<SkillInstall>();
    providerRepo = repoMock<any>([
      {
        id: 1,
        tenantId: 'system',
        name: 'local',
        source: 'local-ollama',
        enabled: true,
        isDefault: true,
      },
      { id: 2, tenantId: 't1', name: 'byo', source: 'tenant-byo', enabled: true, isDefault: false },
    ]);
    // 夹具语义：应用视角 provider 表为空，seed 应补默认项（首次 count 按空库）
    providerRepo.count
      .mockResolvedValueOnce(0)
      .mockImplementation(async () => providerRepo.store.length);
    audit = { record: jest.fn().mockResolvedValue(undefined) };

    svc = new SkillCenterService(skillRepo, installRepo, providerRepo, audit);
  });

  it('ensureSeeded 首次 seed 5 类内置技能与默认 Provider', async () => {
    await svc.ensureSeeded();
    expect(skillRepo.store.length).toBe(5);
    expect(skillRepo.store.every((s) => s.tenantId === 'system' && s.enabled)).toBe(true);
    expect(providerRepo.store.filter((p) => p.isDefault).length).toBe(6);
    // 幂等
    await svc.ensureSeeded();
    expect(skillRepo.store.length).toBe(5);
    expect(providerRepo.store.length).toBe(7);
  });

  it('getMarket 在 seed 后返回 5 类且默认未安装', async () => {
    await svc.ensureSeeded();
    const market = await svc.getMarket('t1');
    expect(market.length).toBe(5);
    expect(market.every((m) => !m.installed)).toBe(true);
  });

  it('install 启用技能并记录审计，uninstall 后不可见', async () => {
    await svc.ensureSeeded();
    const skill = skillRepo.store[0];
    const installed = await svc.install('t1', skill.id);
    expect(installed.installed).toBe(true);
    expect(installed.enabled).toBe(true);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'skill_install', module: 'skill-center' }),
    );

    // 门禁：启用后可调用
    expect(await svc.isEnabled('t1', skill.type)).toBe(true);

    await svc.uninstall('t1', skill.id);
    expect(await svc.isEnabled('t1', skill.type)).toBe(false);
  });

  it('setProvider 需先启用技能，且门禁按类型判断', async () => {
    await svc.ensureSeeded();
    const skill = skillRepo.store[1];
    await expect(svc.setProvider('t1', skill.id, 2)).rejects.toMatchObject({
      code: 'SKILL_NOT_INSTALLED',
    });

    await svc.install('t1', skill.id, 1);
    const updated = await svc.setProvider('t1', skill.id, 2);
    expect(updated.providerId).toBe(2);
    expect(await svc.isEnabled('t1', skill.type)).toBe(true);
  });

  it('install 绑定不可用的 Provider 抛 PROVIDER_NOT_FOUND', async () => {
    await svc.ensureSeeded();
    const skill = skillRepo.store[0];
    await expect(svc.install('t1', skill.id, 999)).rejects.toMatchObject({
      code: 'PROVIDER_NOT_FOUND',
    });
  });

  it('getInstalled 仅返回已启用技能', async () => {
    await svc.ensureSeeded();
    await svc.install('t1', skillRepo.store[0].id);
    await svc.install('t1', skillRepo.store[1].id);
    await svc.uninstall('t1', skillRepo.store[0].id);
    const installed = await svc.getInstalled('t1');
    expect(installed.length).toBe(1);
    expect(installed[0].skillId).toBe(skillRepo.store[1].id);
  });

  it('createProvider 加密存 API Key，resolveByoProvider 返回解密后的凭证与 baseUrl', async () => {
    await svc.ensureSeeded();
    const created = await svc.createProvider('t1', {
      type: 'text-generate',
      name: '我的 BYO',
      source: 'tenant-byo',
      apiKey: 'sk-plain-1',
      baseUrl: 'https://relay.example.com/v1',
      models: ['gpt-x'],
    });
    expect(created.apiKeyEnc).toBeDefined();
    expect(created.apiKeyEnc).not.toBe('sk-plain-1');
    expect(created.baseUrl).toBe('https://relay.example.com/v1');

    // 绑定后网关可解析
    const skill = skillRepo.store.find((s) => s.type === 'text-generate')!;
    await svc.install('t1', skill.id, created.id);
    const resolved = await svc.resolveByoProvider('t1', 'text-generate');
    expect(resolved).not.toBeNull();
    expect(resolved!.apiKey).toBe('sk-plain-1');
    expect(resolved!.provider.baseUrl).toBe('https://relay.example.com/v1');
  });

  it('resolveByoProvider：本地源/无 baseUrl/未绑定均返回 null', async () => {
    await svc.ensureSeeded();
    const skill = skillRepo.store[0];
    // 未绑定
    expect(await svc.resolveByoProvider('t1', skill.type)).toBeNull();
    // 绑定本地源 → null
    await svc.install('t1', skill.id, 1);
    expect(await svc.resolveByoProvider('t1', skill.type)).toBeNull();
    // 绑定无 baseUrl 的 BYO → null
    const noUrl = await svc.createProvider('t1', {
      type: 'text-generate',
      name: 'no-url',
      source: 'tenant-byo',
      apiKey: 'k2',
    });
    await svc.setProvider('t1', skill.id, noUrl.id);
    expect(await svc.resolveByoProvider('t1', skill.type)).toBeNull();
  });

  it('deleteProvider：被技能绑定中抛 PROVIDER_BOUND，解绑后可软删', async () => {
    await svc.ensureSeeded();
    const p = await svc.createProvider('t1', {
      type: 'text-generate',
      name: 'del-me',
      source: 'tenant-byo',
      apiKey: 'k3',
      baseUrl: 'https://x.example.com/v1',
    });
    const skill = skillRepo.store[0];
    await svc.install('t1', skill.id, p.id);
    await expect(svc.deleteProvider('t1', p.id)).rejects.toMatchObject({ code: 'PROVIDER_BOUND' });

    // 解绑（setProvider 需启用态）→ 删除成功且列表不可见
    await svc.setProvider('t1', skill.id, 1);
    const del = await svc.deleteProvider('t1', p.id);
    expect(del.id).toBe(p.id);
    const list = await svc.listProviders('t1');
    expect(list.find((x) => x.id === p.id)).toBeUndefined();
  });
});
