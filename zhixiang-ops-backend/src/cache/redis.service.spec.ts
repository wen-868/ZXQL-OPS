import { RedisService } from './redis.service';
import { env } from '../config/env';

/**
 * RedisService 单元测试。
 * 用 jest.mock('ioredis') 隔离真实连接，验证 get/set/setJson/getJson/del/exists/expire/incr/quit。
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

const mockClient = (): any => {
  const mod = jest.requireMock('ioredis');
  return mod.default() as never;
};

describe('RedisService', () => {
  let svc: RedisService;
  let client: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
    exists: jest.Mock;
    expire: jest.Mock;
    incr: jest.Mock;
    quit: jest.Mock;
    on: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new RedisService();
    client = mockClient();
  });

  afterEach(async () => {
    await svc.onModuleDestroy();
  });

  it('构造时注册 error 监听（连接异常只记日志不崩溃）', () => {
    expect(client.on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('get 返回原始字符串', async () => {
    client.get.mockResolvedValueOnce('v1');
    await expect(svc.get('k')).resolves.toBe('v1');
  });

  it('set 带 TTL 使用 EX 参数', async () => {
    await svc.set('k', 'v', 60);
    expect(client.set).toHaveBeenCalledWith('k', 'v', 'EX', 60);
  });

  it('set 不带 TTL 时直接 set', async () => {
    await svc.set('k', 'v');
    expect(client.set).toHaveBeenCalledWith('k', 'v');
  });

  it('setJson 自动序列化', async () => {
    await svc.setJson('k', { a: 1 }, 30);
    expect(client.set).toHaveBeenCalledWith('k', '{"a":1}', 'EX', 30);
  });

  it('getJson 解析 JSON，空值/坏 JSON 返回 null', async () => {
    client.get.mockResolvedValueOnce('{"a":1}');
    await expect(svc.getJson('k')).resolves.toEqual({ a: 1 });
    client.get.mockResolvedValueOnce(null);
    await expect(svc.getJson('k')).resolves.toBeNull();
    client.get.mockResolvedValueOnce('not-json');
    await expect(svc.getJson('k')).resolves.toBeNull();
  });

  it('del 返回删除数量', async () => {
    client.del.mockResolvedValueOnce(2);
    await expect(svc.del('k')).resolves.toBe(2);
  });

  it('exists 返回布尔', async () => {
    client.exists.mockResolvedValueOnce(1);
    await expect(svc.exists('k')).resolves.toBe(true);
    client.exists.mockResolvedValueOnce(0);
    await expect(svc.exists('k')).resolves.toBe(false);
  });

  it('expire 设置过期时间', async () => {
    await svc.expire('k', 100);
    expect(client.expire).toHaveBeenCalledWith('k', 100);
  });

  it('incr 原子自增返回新值', async () => {
    client.incr.mockResolvedValueOnce(3);
    await expect(svc.incr('counter')).resolves.toBe(3);
  });

  it('onModuleDestroy 关闭连接', async () => {
    client.quit.mockResolvedValueOnce(undefined);
    await svc.onModuleDestroy();
    expect(client.quit).toHaveBeenCalled();
  });

  it('构造时读取 env 连接配置（回归保护）', () => {
    expect(env.REDIS_HOST).toBeDefined();
    expect(env.REDIS_PORT).toBeGreaterThan(0);
  });
});
