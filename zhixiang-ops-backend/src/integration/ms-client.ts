import { env } from '../config/env';
import { AppError } from '../shared/app-error';

/**
 * 管理系统 API 客户端（统一管理后台方案 §5.4）。
 * - 服务账号凭证换取短时 JWT（POST /admin/auth/service-token），按租户缓存
 * - 统一封装 GET/POST，响应信封 {code,msg,data,traceId}
 * - 401 时清缓存重试一次（token 过期自愈）
 */

interface CachedToken {
  token: string;
  expiresAt: number;
}

export class MsApiClient {
  private readonly tokenCache = new Map<string, CachedToken>();

  constructor(private readonly baseUrl: string = env.OPS_MS_API_BASE) {}

  /** 换取/缓存指定租户的服务账号 token（提前 60s 续期） */
  private async getToken(tenantId: string): Promise<string> {
    const cached = this.tokenCache.get(tenantId);
    if (cached && Date.now() < cached.expiresAt) return cached.token;

    const clientId = env.OPS_MS_CLIENT_ID;
    const clientSecret = env.OPS_MS_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new AppError('MS_CLIENT_NOT_CONFIGURED');
    }

    const resp = await fetch(`${this.baseUrl}/admin/auth/service-token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clientId, clientSecret, tenantId }),
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await resp.json().catch(() => null)) as {
      code?: string;
      data?: { token?: string; expiresIn?: number };
    } | null;
    if (!resp.ok || json?.code !== '0' || !json?.data?.token) {
      throw new AppError('MS_API_ERROR', undefined, {
        stage: 'service-token',
        status: resp.status,
        code: json?.code,
      });
    }

    const { token, expiresIn } = json.data;
    this.tokenCache.set(tenantId, {
      token,
      expiresAt: Date.now() + Math.max((expiresIn ?? 3600) - 60, 60) * 1000,
    });
    return token;
  }

  /** 通用请求：自动带服务账号 token，解析统一响应信封 */
  async request<T>(
    method: 'GET' | 'POST' | 'PUT',
    path: string,
    opts: { tenantId: string; query?: Record<string, unknown>; body?: unknown } = {
      tenantId: 'default',
    },
  ): Promise<T> {
    const { tenantId, query, body } = opts;
    const url = new URL(`${this.baseUrl}${path}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.set(key, typeof value === 'string' ? value : JSON.stringify(value));
        }
      }
    }

    const token = await this.getToken(tenantId);
    const headers: Record<string, string> = {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    };
    const doFetch = (authToken: string) =>
      fetch(url, {
        method,
        headers: { ...headers, authorization: `Bearer ${authToken}` },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });

    let resp = await doFetch(token);
    // token 过期（401）→ 清缓存重试一次
    if (resp.status === 401) {
      this.tokenCache.delete(tenantId);
      const freshToken = await this.getToken(tenantId);
      resp = await doFetch(freshToken);
    }
    return this.parse<T>(resp, path);
  }

  private async parse<T>(resp: Response, path: string): Promise<T> {
    const json = (await resp.json().catch(() => null)) as {
      code?: string;
      msg?: string;
      data?: T;
    } | null;
    if (!resp.ok || json?.code !== '0') {
      throw new AppError('MS_API_ERROR', undefined, {
        path,
        status: resp.status,
        code: json?.code,
        msg: json?.msg,
      });
    }
    return json.data as T;
  }
}
