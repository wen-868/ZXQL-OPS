import { AccountOAuthService } from './account-oauth.service';
import { OAuthAdapterFactory } from './platform-oauth.adapter';
import { TenantContext } from '../../../tenant/tenant-context';

type AnyRecord = Record<string, unknown>;

type Repo<T> = {
  create: jest.Mock<T, [Partial<T>]>;
  save: jest.Mock<Promise<T>, [Partial<T>]>;
  findOne: jest.Mock<Promise<T | null>, [Record<string, unknown>]>;
};

function mockRepo<T extends AnyRecord>() {
  const repo = {} as Repo<T>;
  repo.create = jest.fn((p: Partial<T>) => ({ id: 1, ...p }) as unknown as T);
  repo.save = jest.fn(async (e: Partial<T>) => e as T);
  repo.findOne = jest.fn();
  return repo;
}

describe('AccountOAuthService', () => {
  const stateRepo = mockRepo<AnyRecord>();
  const accountRepo = mockRepo<AnyRecord>();
  const eventRepo = mockRepo<AnyRecord>();
  const config = {
    getMany: jest.fn(async () => ({ 'oauth.douyin.appId': '', 'oauth.douyin.appSecret': '' })),
  };

  const svc = new AccountOAuthService(
    stateRepo as never,
    accountRepo as never,
    eventRepo as never,
    config as never,
  );

  const TEN_MIN = 10 * 60 * 1000;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('start', () => {
    it('生成一次性 state（未使用后 10 分钟内过期）并返回平台授权链接', async () => {
      const before = Date.now();
      const result = await TenantContext.run({ traceId: 't-o1', tenantId: 'tn-1' }, () =>
        svc.start({ platform: 'douyin' }),
      );

      expect(result.state).toHaveLength(32);
      expect(result.platform).toBe('douyin');
      expect(result.configured).toBe(false);
      expect(result.authorizeUrl).toContain('open.douyin.com');
      expect(stateRepo.save).toHaveBeenCalledTimes(1);
      const saved = stateRepo.save.mock.calls[0][0];
      expect(saved.used).toBe(false);
      expect((saved.expiresAt as Date).getTime() - before).toBeGreaterThanOrEqual(TEN_MIN);
      expect(saved.tenantId).toBe('tn-1');
    });

    it('不支持的平台抛出 OAUTH_PLATFORM_UNSUPPORTED', async () => {
      await expect(
        TenantContext.run({ traceId: 't-o2', tenantId: 'tn-1' }, () =>
          svc.start({ platform: 'wx' }),
        ),
      ).rejects.toMatchObject({ code: 'OAUTH_PLATFORM_UNSUPPORTED' });
    });

    it('非抖音平台走 Stub 授权链接（可全链路演示）', async () => {
      const result = await TenantContext.run({ traceId: 't-o3', tenantId: 'tn-1' }, () =>
        svc.start({ platform: 'kuaishou' }),
      );
      expect(result.configured).toBe(false);
      expect(result.authorizeUrl).toContain('/api/ops/accounts/oauth/callback');
    });
  });

  describe('callback', () => {
    it('state 不存在抛出 OAUTH_STATE_INVALID', async () => {
      stateRepo.findOne.mockResolvedValueOnce(null);
      await expect(svc.callback({ state: 'nope', code: 'c' })).rejects.toMatchObject({
        code: 'OAUTH_STATE_INVALID',
      });
    });

    it('state 已使用抛出 OAUTH_STATE_INVALID', async () => {
      stateRepo.findOne.mockResolvedValueOnce({
        state: 's',
        used: true,
        expiresAt: new Date(Date.now() + 60000),
      });
      await expect(svc.callback({ state: 's', code: 'c' })).rejects.toMatchObject({
        code: 'OAUTH_STATE_INVALID',
      });
    });

    it('state 已过期抛出 OAUTH_STATE_EXPIRED', async () => {
      stateRepo.findOne.mockResolvedValueOnce({
        state: 's',
        used: false,
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(svc.callback({ state: 's', code: 'c' })).rejects.toMatchObject({
        code: 'OAUTH_STATE_EXPIRED',
      });
    });

    it('新账号：新 Token 加密落库 + connected 健康事件 + state 标记已用', async () => {
      stateRepo.findOne.mockResolvedValueOnce({
        state: 's1',
        used: false,
        platform: 'douyin',
        expiresAt: new Date(Date.now() + 60000),
        tenantId: 'tn-1',
      });
      accountRepo.findOne.mockResolvedValueOnce(null); // 无既有账号
      const result = await svc.callback({ state: 's1', code: 'auth-ok' });

      expect(result.mode).toBe('created');
      expect(stateRepo.save.mock.calls[0][0].used).toBe(true);

      const savedAccount = accountRepo.save.mock.calls[0][0];
      expect(savedAccount.tenantId).toBe('tn-1');
      expect(savedAccount.platform).toBe('douyin');
      expect(savedAccount.status).toBe('normal');
      expect(savedAccount.tokenEnc).toBeDefined();
      expect(savedAccount.tokenEnc).not.toBe('auth-ok'); // 非明文落地
      expect(savedAccount.platformAccountId).toBe('douyin-stub-user');

      expect(eventRepo.save).toHaveBeenCalledTimes(1);
      expect(eventRepo.save.mock.calls[0][0].eventType).toBe('connected');
    });

    it('既有账号：更新 Token 与状态 + token_refreshed 事件，不重复建号', async () => {
      stateRepo.findOne.mockResolvedValueOnce({
        state: 's2',
        used: false,
        platform: 'douyin',
        expiresAt: new Date(Date.now() + 60000),
        tenantId: 'tn-1',
      });
      accountRepo.findOne.mockResolvedValueOnce({
        id: 42,
        tenantId: 'tn-1',
        platform: 'douyin',
        platformAccountId: 'douyin-stub-user',
        nickname: '老号',
      });

      const result = await svc.callback({ state: 's2', code: 'auth-again' });

      expect(result.mode).toBe('refreshed');
      expect(result.accountId).toBe(42);
      expect(accountRepo.save).toHaveBeenCalledTimes(1);
      expect(accountRepo.save.mock.calls[0][0].status).toBe('normal');
      expect(eventRepo.save.mock.calls[0][0].eventType).toBe('token_refreshed');
    });
  });

  describe('OAuthAdapterFactory', () => {
    it('douyin 适配器未配置凭证时 isConfigured=false（Stub 返回 Token）', async () => {
      const adapter = OAuthAdapterFactory.resolve('douyin');
      expect(adapter.platform).toBe('douyin');
      expect(adapter.isConfigured()).toBe(false);
      const token = await adapter.exchangeToken('code-1');
      expect(token.openId).toBe('douyin-stub-user');
      expect(token.accessToken).toBe('stub-code-1');
    });

    it('douyin 配置中心提供凭证时 isConfigured=true（真实授权链接）', () => {
      const adapter = OAuthAdapterFactory.resolve('douyin', () => ({
        appId: 'client_key_1',
        appSecret: 'secret_1',
      }));
      expect(adapter.isConfigured()).toBe(true);
      expect(adapter.buildAuthorizeUrl('st1')).toContain('client_key=client_key_1');
      expect(adapter.buildAuthorizeUrl('st1')).toContain('state=st1');
    });
  });
});
