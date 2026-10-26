import { LoginRateLimitService, LOGIN_MAX_FAILS, LOGIN_LOCK_MS } from './login-rate-limit.service';
import { RedisService } from './redis.service';

/**
 * LoginRateLimitService 单测（商业级清单 C1）。
 * 覆盖：Redis 原子计数路径、锁定窗口/顺延、内存兜底路径、reset。
 */

jest.mock('ioredis', () => {
  const client = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    incr: jest.fn(),
    quit: jest.fn(),
    on: jest.fn(),
  };
  return { __esModule: true, default: jest.fn(() => client) };
});

const redisClient = (): any => {
  const mod = jest.requireMock('ioredis');
  return mod.default() as never;
};

/** 构造 Redis 可用的服务（client 各方法由用例自行 stub） */
function redisUpService() {
  const svc = new LoginRateLimitService(new RedisService());
  const client = redisClient();
  jest.clearAllMocks();
  return { svc, client };
}

/** 构造 Redis 不可用（读写均抛）→ 内存兜底 */
function redisDownService() {
  const client = {
    get: jest.fn().mockRejectedValue(new Error('down')),
    incr: jest.fn().mockRejectedValue(new Error('down')),
    expire: jest.fn(),
    setJson: jest.fn(),
    del: jest.fn().mockRejectedValue(new Error('down')),
  };
  return new LoginRateLimitService({ client } as unknown as RedisService);
}

describe('LoginRateLimitService.key', () => {
  it('按 IP+username 组装限流键', () => {
    expect(LoginRateLimitService.key('1.2.3.4', 'admin')).toBe('ops:login:fail:1.2.3.4:admin');
  });
});

describe('LoginRateLimitService（Redis 可用）', () => {
  it('无计数时放行', async () => {
    const { svc, client } = redisUpService();
    client.get.mockResolvedValueOnce(null);
    await expect(svc.assertAllowed('ops:login:fail:ip:u')).resolves.toBeUndefined();
  });

  it('计数阶段（纯数字）放行，锁定阶段 JSON 命中则 429', async () => {
    const { svc, client } = redisUpService();
    client.get.mockResolvedValueOnce('3');
    await expect(svc.assertAllowed('k')).resolves.toBeUndefined();
    client.get.mockResolvedValueOnce(JSON.stringify({ lockedUntil: Date.now() + 10000 }));
    await expect(svc.assertAllowed('k')).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
      httpStatus: 429,
    });
  });

  it('recordFailure 用 incr 计数，首次设置过期', async () => {
    const { svc, client } = redisUpService();
    client.incr.mockResolvedValueOnce(1);
    client.expire.mockResolvedValueOnce(1);
    await svc.recordFailure('k');
    expect(client.incr).toHaveBeenCalledWith('k');
    expect(client.expire).toHaveBeenCalledWith('k', LOGIN_LOCK_MS / 1000);
  });

  it('达到阈值写入锁定 JSON（TTL=锁定窗口）', async () => {
    const { svc, client } = redisUpService();
    client.incr.mockResolvedValueOnce(LOGIN_MAX_FAILS);
    client.set.mockResolvedValueOnce('OK');
    await svc.recordFailure('k');
    // setJson 走 RedisService → client.set(JSON)
    expect(client.set).toHaveBeenCalledWith('k', expect.any(String), 'EX', LOGIN_LOCK_MS / 1000);
    const payload = client.set.mock.calls[0][1] as string;
    expect(JSON.parse(payload)).toEqual(
      expect.objectContaining({ lockedUntil: expect.any(Number) }),
    );
  });

  it('reset 删除 Redis 键', async () => {
    const { svc, client } = redisUpService();
    client.del.mockResolvedValueOnce(1);
    await svc.reset('k');
    expect(client.del).toHaveBeenCalledWith('k');
  });
});

describe('LoginRateLimitService（Redis 不可用 → 内存兜底）', () => {
  it('连续失败达到阈值后锁定，窗口内拒绝', async () => {
    const svc = redisDownService();
    for (let i = 0; i < LOGIN_MAX_FAILS; i += 1) {
      await svc.recordFailure('k');
    }
    await expect(svc.assertAllowed('k')).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' });
  });

  it('锁定期内继续失败自动顺延锁定窗口', async () => {
    const svc = redisDownService();
    for (let i = 0; i < LOGIN_MAX_FAILS; i += 1) {
      await svc.recordFailure('k');
    }
    await svc.recordFailure('k'); // 锁定期间再失败
    await expect(svc.assertAllowed('k')).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' });
  });

  it('锁定过期后放行并惰性清理', async () => {
    const svc = redisDownService();
    for (let i = 0; i < LOGIN_MAX_FAILS; i += 1) {
      await svc.recordFailure('k');
    }
    const realNow = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(realNow + LOGIN_LOCK_MS + 1000);
    await expect(svc.assertAllowed('k')).resolves.toBeUndefined();
    jest.restoreAllMocks();
  });

  it('reset 清除内存计数', async () => {
    const svc = redisDownService();
    await svc.recordFailure('k');
    await svc.reset('k');
    await expect(svc.assertAllowed('k')).resolves.toBeUndefined();
  });

  it('未达阈值时放行', async () => {
    const svc = redisDownService();
    await svc.recordFailure('k');
    await expect(svc.assertAllowed('k')).resolves.toBeUndefined();
  });
});
