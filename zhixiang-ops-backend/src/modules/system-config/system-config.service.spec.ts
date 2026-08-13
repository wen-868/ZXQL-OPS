import { SystemConfigService } from './system-config.service';
import { SystemConfigEntity } from './system-config.entity';
import { encryptSecret, decryptSecret } from '../../shared/crypto';

function repoMock() {
  const store: SystemConfigEntity[] = [];
  return {
    store,
    findOne: jest.fn(async ({ where }) => store.find((s) => s.key === where.key) ?? null),
    find: jest.fn(async () => store),
    create: jest.fn((d) => ({ ...d })),
    save: jest.fn(async (e: any) => {
      const i = store.findIndex((s) => s.key === e.key);
      if (i >= 0) store[i] = { ...store[i], ...e };
      else store.push(e);
      return e;
    }),
  };
}

describe('SystemConfigService', () => {
  let svc: SystemConfigService;
  let repo: any;

  beforeEach(() => {
    repo = repoMock();
    svc = new SystemConfigService(repo);
  });

  it('set 非敏感键明文存储，get 返回原值', async () => {
    await svc.set('oauth.douyin.appId', 'client_x');
    expect(repo.store[0].valueText).toBe('client_x');
    expect(repo.store[0].valueEnc).toBeUndefined();
    expect(await svc.get('oauth.douyin.appId')).toBe('client_x');
  });

  it('set 敏感键加密存储，get 解密返回，list 掩码', async () => {
    await svc.set('oauth.douyin.appSecret', 'sk-secret-1');
    expect(repo.store[0].isSensitive).toBe(true);
    expect(repo.store[0].valueEnc).toBeDefined();
    expect(repo.store[0].valueEnc).not.toContain('sk-secret-1');
    expect(decryptSecret(repo.store[0].valueEnc)).toBe('sk-secret-1');

    expect(await svc.get('oauth.douyin.appSecret')).toBe('sk-secret-1');
    const list = await svc.list();
    const item = list.find((c) => c.key === 'oauth.douyin.appSecret')!;
    expect(item.value).toBe('******');
    expect(item.masked).toBe(true);
    expect(item.value).not.toBe('sk-secret-1');
  });

  it('未配置的键：get 返回空串，list 掩码为空', async () => {
    expect(await svc.get('oauth.douyin.appId')).toBe('');
    const list = await svc.list();
    expect(list.length).toBe(2);
    expect(list.every((c) => c.value === '')).toBe(true);
  });

  it('白名单外键 set/get 抛 INVALID_PARAM', async () => {
    await expect(svc.set('evil.key', 'x')).rejects.toMatchObject({ code: 'INVALID_PARAM' });
    await expect(svc.get('evil.key')).rejects.toMatchObject({ code: 'INVALID_PARAM' });
  });

  it('更新已有配置：重复 set 覆盖且不产生重复行', async () => {
    await svc.set('oauth.douyin.appId', 'a');
    await svc.set('oauth.douyin.appId', 'b');
    expect(repo.store.length).toBe(1);
    expect(await svc.get('oauth.douyin.appId')).toBe('b');
  });

  it('传空字符串清除配置（重新读取为空）', async () => {
    await svc.set('oauth.douyin.appId', 'abc');
    await svc.set('oauth.douyin.appId', '');
    expect(await svc.get('oauth.douyin.appId')).toBe('');
    expect(repo.store[0].valueText).toBeNull();
  });

  it('getMany 批量解密读取', async () => {
    await svc.set('oauth.douyin.appId', 'cid');
    await svc.set('oauth.douyin.appSecret', 'sec');
    const m = await svc.getMany(['oauth.douyin.appId', 'oauth.douyin.appSecret']);
    expect(m['oauth.douyin.appId']).toBe('cid');
    expect(m['oauth.douyin.appSecret']).toBe('sec');
  });

  it('encryptSecret round-trip', () => {
    const enc = encryptSecret('round-trip-val');
    expect(enc).not.toContain('round-trip-val');
    expect(decryptSecret(enc)).toBe('round-trip-val');
  });
});
