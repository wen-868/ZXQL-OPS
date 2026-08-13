import { MsApiClient } from './ms-client';
import { env } from '../config/env';
import { AppError } from '../shared/app-error';

/**
 * 管理系统 API 客户端单测（方案 §5.4）。
 * 覆盖：服务账号换 token、按租户缓存、401 自愈重试、错误码透传。
 */

const originalFetch = globalThis.fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('MsApiClient（管理系统 API 客户端）', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock;
    env.OPS_MS_CLIENT_ID = 'test-id';
    env.OPS_MS_CLIENT_SECRET = 'test-secret';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    env.OPS_MS_CLIENT_ID = '';
    env.OPS_MS_CLIENT_SECRET = '';
  });

  it('未配置服务账号：抛 MS_CLIENT_NOT_CONFIGURED', async () => {
    env.OPS_MS_CLIENT_ID = '';
    const client = new MsApiClient('https://api.example.com/api');
    await expect(
      client.request('GET', '/admin/products', { tenantId: 't1' }),
    ).rejects.toMatchObject({ code: 'MS_CLIENT_NOT_CONFIGURED' });
  });

  it('服务账号换 token 成功后发起业务请求', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ code: '0', data: { token: 't1', expiresIn: 3600 } }))
      .mockResolvedValueOnce(jsonResponse({ code: '0', data: { list: [{ id: 1 }] } }));

    const client = new MsApiClient('https://api.example.com/api');
    const data = await client.request<{ list: unknown[] }>('GET', '/admin/products', {
      tenantId: 't1',
      query: { page: 1 },
    });

    expect(data.list).toEqual([{ id: 1 }]);
    const tokenCall = fetchMock.mock.calls[0];
    expect(tokenCall[0]).toBe('https://api.example.com/api/admin/auth/service-token');
    expect(JSON.parse(tokenCall[1].body)).toEqual({
      clientId: 'test-id',
      clientSecret: 'test-secret',
      tenantId: 't1',
    });
    expect(fetchMock.mock.calls[1][1].headers.authorization).toBe('Bearer t1');
  });

  it('按租户缓存 token：同租户二次请求不重复换 token', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ code: '0', data: { token: 't1', expiresIn: 3600 } }))
      .mockResolvedValue(jsonResponse({ code: '0', data: {} }));

    const client = new MsApiClient('https://api.example.com/api');
    await client.request('GET', '/admin/products', { tenantId: 't1' });
    await client.request('GET', '/admin/orders', { tenantId: 't1' });

    const tokenCalls = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes('/admin/auth/service-token'),
    );
    expect(tokenCalls).toHaveLength(1);
  });

  it('业务请求 401：清缓存重新换 token 后重试成功', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ code: '0', data: { token: 't1', expiresIn: 3600 } }))
      .mockResolvedValueOnce(jsonResponse({ code: 'UNAUTHORIZED', msg: 'expired' }, 401))
      .mockResolvedValueOnce(jsonResponse({ code: '0', data: { token: 't2', expiresIn: 3600 } }))
      .mockResolvedValueOnce(jsonResponse({ code: '0', data: { ok: true } }));

    const client = new MsApiClient('https://api.example.com/api');
    const data = await client.request<{ ok: boolean }>('GET', '/admin/products', {
      tenantId: 't1',
    });
    expect(data.ok).toBe(true);
    // 重试时用了新 token
    const lastHeaders = fetchMock.mock.calls[3][1].headers;
    expect(lastHeaders.authorization).toBe('Bearer t2');
  });

  it('管理系统业务错误：抛 MS_API_ERROR 并携带上下文', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ code: '0', data: { token: 't1', expiresIn: 3600 } }))
      .mockResolvedValueOnce(jsonResponse({ code: 'PRODUCT_NOT_FOUND', msg: '商品不存在' }, 404));

    const client = new MsApiClient('https://api.example.com/api');
    try {
      await client.request('GET', '/admin/products/999', { tenantId: 't1' });
      expect('不应到达').toBe('');
    } catch (e) {
      expect((e as AppError).code).toBe('MS_API_ERROR');
      expect((e as AppError).httpStatus).toBe(502);
      expect((e as AppError).data).toEqual(
        expect.objectContaining({ path: '/admin/products/999', status: 404 }),
      );
    }
  });
});
