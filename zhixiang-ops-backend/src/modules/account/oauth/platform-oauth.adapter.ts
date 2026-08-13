import { randomUUID } from 'crypto';
import { AppError } from '../../../shared/app-error';
import { Platform } from '../account.types';

/**
 * OAuth 平台适配器（规划 §4-B / B-core OAuth 接入）。
 * 每个平台实现：授权链接构造 + 授权码换 Token。
 * 未配置平台凭证时走 Stub 模式（可全链路演示，详情见 OAuthAdapterFactory）。
 */

export interface OAuthTokenResult {
  accessToken: string;
  refreshToken: string;
  openId: string;
  nickname?: string;
  avatarUrl?: string;
  expiresAt: Date;
}

export interface PlatformOAuthAdapter {
  readonly platform: Platform;
  /** 是否已配置真实平台凭证（false 则走 Stub 演示链路） */
  isConfigured(): boolean;
  /** 构造授权页地址 */
  buildAuthorizeUrl(state: string, redirectUri?: string): string;
  /** 用授权码换取 Token（含 openId） */
  exchangeToken(code: string, redirectUri?: string): Promise<OAuthTokenResult>;
}

/** 抖音 OAuth 凭据加载器（由配置中心注入；未配置时返回空串走 Sandbox） */
export type DouyinCredentialLoader = () => { appId: string; appSecret: string };

/** 抖音开放平台适配器（client_key/client_secret + code 换 token） */
export class DouyinOAuthAdapter implements PlatformOAuthAdapter {
  readonly platform: Platform = 'douyin';
  private readonly baseUrl = 'https://open.douyin.com';

  constructor(private readonly loadCredentials: DouyinCredentialLoader) {}

  private get appId(): string {
    return this.loadCredentials().appId;
  }
  private get appSecret(): string {
    return this.loadCredentials().appSecret;
  }

  isConfigured(): boolean {
    return this.appId.length > 0 && this.appSecret.length > 0;
  }

  buildAuthorizeUrl(state: string, redirectUri?: string): string {
    const params = new URLSearchParams({
      client_key: this.appId,
      response_type: 'code',
      scope: 'user_info,video.create',
      state,
    });
    if (redirectUri) params.set('redirect_uri', redirectUri);
    return `${this.baseUrl}/platform/oauth/connect/?${params.toString()}`;
  }

  async exchangeToken(code: string, redirectUri?: string): Promise<OAuthTokenResult> {
    if (!this.isConfigured()) {
      // Stub：未配置凭证时的演示链路（token 为确定性 mock，便于联调）
      return this.stubExchange(code);
    }
    const params = new URLSearchParams({
      client_key: this.appId,
      client_secret: this.appSecret,
      code,
      grant_type: 'authorization_code',
    });
    if (redirectUri) params.set('redirect_uri', redirectUri);

    const resp = await fetch(`${this.baseUrl}/oauth/access_token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: AbortSignal.timeout(30_000),
    });
    const json = (await resp.json()) as {
      data?: {
        access_token?: string;
        refresh_token?: string;
        open_id?: string;
        expires_in?: number;
        refresh_expires_in?: number;
      };
      message?: string;
    };
    if (!json.data) {
      throw new AppError(
        'EXTERNAL_SERVICE_ERROR',
        `抖音 OAuth 换 Token 失败: ${json.message ?? '未知错误'}`,
      );
    }
    const {
      access_token: accessToken,
      refresh_token: refreshToken,
      open_id: openId,
      expires_in: expiresIn,
    } = json.data;
    if (!accessToken || !openId) {
      throw new AppError(
        'EXTERNAL_SERVICE_ERROR',
        `抖音 OAuth 换 Token 失败: ${json.message ?? '未知错误'}`,
      );
    }
    return {
      accessToken,
      refreshToken: refreshToken ?? '',
      openId,
      expiresAt: new Date(Date.now() + (expiresIn ?? 86400) * 1000),
    };
  }

  private stubExchange(code: string): Promise<OAuthTokenResult> {
    const mock = `stub-${code}`;
    return Promise.resolve({
      accessToken: mock,
      refreshToken: `stub-rt-${code}`,
      openId: `douyin-stub-user`,
      nickname: `抖音演示账号`,
      expiresAt: new Date(Date.now() + 3600 * 1000),
    });
  }
}

/** 通用 Stub 适配器：未接入真实平台的演示链路 */
export class StubOAuthAdapter implements PlatformOAuthAdapter {
  readonly platform: Platform;

  constructor(platform: Platform) {
    this.platform = platform;
  }

  isConfigured(): boolean {
    return false;
  }

  buildAuthorizeUrl(state: string): string {
    // 演示链路：直接指向本服务回调（code=stub 模拟平台授权完成）
    return `/api/ops/accounts/oauth/callback?state=${encodeURIComponent(state)}&code=stub-${this.platform}`;
  }

  exchangeToken(code: string): Promise<OAuthTokenResult> {
    return Promise.resolve({
      accessToken: `stub-at-${code}`,
      refreshToken: `stub-rt-${code}`,
      openId: `${this.platform}-stub-user`, // 演示账号：同平台同 openId，重复回调走更新
      nickname: `${this.platform} 演示账号`,
      expiresAt: new Date(Date.now() + 3600 * 1000),
    });
  }
}

/**
 * 适配器工厂：douyin → 真实适配器（未配置凭证时内部降级 Stub）；其余平台 → Stub。
 * 平台白名单与账号矩阵一致（account.types PLATFORMS）。
 */
export class OAuthAdapterFactory {
  private static readonly VIDEO_PLATFORMS: Platform[] = [
    'douyin',
    'kuaishou',
    'xiaohongshu',
    'bilibili',
    'wechat-channels',
  ];

  static resolve(platform: string, credentials?: DouyinCredentialLoader): PlatformOAuthAdapter {
    if (!(this.VIDEO_PLATFORMS as string[]).includes(platform)) {
      throw new AppError('OAUTH_PLATFORM_UNSUPPORTED', `不支持 OAuth 的平台: ${platform}`);
    }
    if (platform === 'douyin') {
      const loader: DouyinCredentialLoader = credentials ?? (() => ({ appId: '', appSecret: '' }));
      return new DouyinOAuthAdapter(loader);
    }
    return new StubOAuthAdapter(platform as Platform);
  }
}

/** state 生成器（randomUUID 截断为 32 位十六进制） */
export function generateOAuthState(): string {
  return randomUUID().replace(/-/g, '').substring(0, 32);
}
