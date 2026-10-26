import { CollectRateLimiter } from './rate-limiter';
import { RedisService } from '../../cache/redis.service';

/**
 * CollectRateLimiter 令牌桶限流单测。
 * 覆盖：raw 缺失/正常/NAN 重置、令牌充足放行扣减、令牌不足限流、TTL 计算。
 */

describe('CollectRateLimiter', () => {
  let redis: { get: jest.Mock; set: jest.Mock };
  let limiter: CollectRateLimiter;
  const NOW = 1_700_000_000_000;

  beforeEach(() => {
    redis = { get: jest.fn(), set: jest.fn() };
    limiter = new CollectRateLimiter(redis as unknown as RedisService);
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('raw 为 null：从 capacity 起算并放行，TTL=ceil(capacity/refill)+1', async () => {
    redis.get.mockResolvedValueOnce(null);
    await expect(limiter.allow('t1', 'douyin', 10, 1)).resolves.toBe(true);
    expect(redis.set).toHaveBeenCalledWith(
      'collect:tb:t1:douyin',
      `${10 - 1}:${NOW}`,
      Math.max(1, Math.ceil(10 / 1) + 1),
    );
  });

  it('raw 正常（tokens:ts）：用缓存令牌扣减放行', async () => {
    redis.get.mockResolvedValueOnce('5:1000');
    await expect(limiter.allow('t1', 'douyin', 10, 1)).resolves.toBe(true);
    // ts=1000，经 1700000000s 流逝，refill 后 min(10, 5+elapsed) = 10 → 扣 1 存 9
    expect(redis.set).toHaveBeenCalledWith('collect:tb:t1:douyin', `9:${NOW}`, 11);
  });

  it('tokens 解析 NaN：重置为 capacity 再放行', async () => {
    redis.get.mockResolvedValueOnce('abc:1000');
    await expect(limiter.allow('t1', 'douyin', 10, 1)).resolves.toBe(true);
    expect(redis.set).toHaveBeenCalledWith('collect:tb:t1:douyin', `9:${NOW}`, 11);
  });

  it('ts 解析 NaN：重置为 capacity 再放行', async () => {
    redis.get.mockResolvedValueOnce('5:xyz');
    await expect(limiter.allow('t1', 'douyin', 10, 1)).resolves.toBe(true);
    expect(redis.set).toHaveBeenCalledWith('collect:tb:t1:douyin', `9:${NOW}`, 11);
  });

  it('令牌不足（tokens<1）且无流逝补充：限流返回 false', async () => {
    // ts=NOW，elapsed=0，tokens=0 <1 → 限流
    redis.get.mockResolvedValueOnce(`0:${NOW}`);
    await expect(limiter.allow('t1', 'douyin', 10, 1)).resolves.toBe(false);
    expect(redis.set).toHaveBeenCalledWith('collect:tb:t1:douyin', `0:${NOW}`, 11);
  });

  it('令牌经流逝补充到 ≥1：放行并扣减', async () => {
    // ts = NOW - 2000（2s 前），refill=1 → 0 + 2 = 2 ≥ 1 → 放行，存 1
    redis.get.mockResolvedValueOnce(`0:${NOW - 2000}`);
    await expect(limiter.allow('t1', 'douyin', 10, 1)).resolves.toBe(true);
    expect(redis.set).toHaveBeenCalledWith('collect:tb:t1:douyin', `1:${NOW}`, 11);
  });

  it('小容量/低 refill：TTL 保底为 1', async () => {
    redis.get.mockResolvedValueOnce(null);
    await expect(limiter.allow('t1', 'kuaishou', 0.4, 0.1)).resolves.toBe(false);
    // ceil(0.4/0.1)+1 = 5；Math.max(1,5)=5
    expect(redis.set).toHaveBeenCalledWith('collect:tb:t1:kuaishou', expect.any(String), 5);
  });

  it('键名组装：collect:tb:<tenantId>:<platform>', async () => {
    redis.get.mockResolvedValueOnce(null);
    await limiter.allow('租户A', 'xhs', 2, 1);
    expect(redis.get).toHaveBeenCalledWith('collect:tb:租户A:xhs');
  });
});
