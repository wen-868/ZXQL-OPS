import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppError } from '../../../shared/app-error';
import { encryptSecret } from '../../../shared/crypto';
import { TenantContext } from '../../../tenant/tenant-context';
import { SystemConfigService } from '../../system-config/system-config.service';
import { AccountEntity } from '../account.entity';
import { AccountHealthEventEntity } from '../account-health-event.entity';
import { AccountOAuthStateEntity } from './oauth-state.entity';
import { generateOAuthState, OAuthAdapterFactory } from './platform-oauth.adapter';
import { OAuthCallbackQueryDto, OAuthStartDto } from './dto/oauth.dto';

/** state 有效期（分钟） */
const STATE_TTL_MINUTES = 10;

const CRED_KEYS = ['oauth.douyin.appId', 'oauth.douyin.appSecret'];

/**
 * B 域账号 OAuth 接入（规划 §4-B / B-core OAuth 接入）。
 * 流程：POST /accounts/oauth/start 生成一次性 state → 平台授权 → GET /accounts/oauth/callback
 * 校验 state 后换 Token，加密落账号（tokenEnc/refreshTokenEnc），并记健康事件。
 * 平台凭证经「配置中心」读取（客户自决）；未配置时走 Stub 链路（Sandbox 演示）。
 */
@Injectable()
export class AccountOAuthService {
  private readonly logger = new Logger(AccountOAuthService.name);

  constructor(
    @InjectRepository(AccountOAuthStateEntity)
    private readonly stateRepo: Repository<AccountOAuthStateEntity>,
    @InjectRepository(AccountEntity)
    private readonly accountRepo: Repository<AccountEntity>,
    @InjectRepository(AccountHealthEventEntity)
    private readonly eventRepo: Repository<AccountHealthEventEntity>,
    private readonly config: SystemConfigService,
  ) {}

  private async resolveAdapter(platform: string) {
    const creds = await this.config.getMany(CRED_KEYS);
    return OAuthAdapterFactory.resolve(platform, () => ({
      appId: creds['oauth.douyin.appId'] ?? '',
      appSecret: creds['oauth.douyin.appSecret'] ?? '',
    }));
  }

  /** 发起授权：生成一次性 state 并返回平台授权链接 */
  async start(dto: OAuthStartDto): Promise<{
    authorizeUrl: string;
    state: string;
    platform: string;
    configured: boolean;
  }> {
    const tenantId = TenantContext.requireTenantId();
    const adapter = await this.resolveAdapter(dto.platform);
    const state = generateOAuthState();

    await this.stateRepo.save(
      this.stateRepo.create({
        tenantId,
        state,
        platform: dto.platform,
        redirectUri: dto.redirectUri,
        used: false,
        expiresAt: new Date(Date.now() + STATE_TTL_MINUTES * 60 * 1000),
      }),
    );

    return {
      authorizeUrl: adapter.buildAuthorizeUrl(state, dto.redirectUri),
      state,
      platform: dto.platform,
      configured: adapter.isConfigured(),
    };
  }

  /** 平台回调：校验 state（一次性 + 未过期）→ 换 Token → 落账号（存在则更新） */
  async callback(query: OAuthCallbackQueryDto): Promise<{
    accountId: number;
    platform: string;
    nickname?: string;
    mode: 'created' | 'refreshed';
  }> {
    const stateRow = await this.stateRepo.findOne({ where: { state: query.state } });
    if (!stateRow || stateRow.used) {
      throw new AppError('OAUTH_STATE_INVALID');
    }
    if (stateRow.expiresAt.getTime() < Date.now()) {
      throw new AppError('OAUTH_STATE_EXPIRED');
    }

    stateRow.used = true;
    await this.stateRepo.save(stateRow);

    const adapter = await this.resolveAdapter(stateRow.platform);
    const token = await adapter.exchangeToken(query.code, stateRow.redirectUri);

    const tenantId = stateRow.tenantId;
    const existing = await this.accountRepo.findOne({
      where: {
        tenantId,
        platform: stateRow.platform as AccountEntity['platform'],
        platformAccountId: token.openId,
      },
    });

    if (existing) {
      existing.tokenEnc = encryptSecret(token.accessToken);
      existing.refreshTokenEnc = encryptSecret(token.refreshToken);
      existing.tokenExpireAt = token.expiresAt;
      existing.status = 'normal';
      if (token.nickname) existing.nickname = token.nickname;
      if (token.avatarUrl) existing.avatarUrl = token.avatarUrl;
      existing.lastActiveAt = new Date();
      await this.accountRepo.save(existing);
      await this.logEvent(existing, 'token_refreshed', '重新授权成功');
      this.logger.log(`OAuth 刷新账号 #${existing.id} (${stateRow.platform})`);
      return {
        accountId: existing.id,
        platform: stateRow.platform,
        nickname: existing.nickname,
        mode: 'refreshed',
      };
    }

    const account = this.accountRepo.create({
      tenantId,
      platform: stateRow.platform as AccountEntity['platform'],
      platformAccountId: token.openId,
      nickname: token.nickname,
      avatarUrl: token.avatarUrl,
      tokenEnc: encryptSecret(token.accessToken),
      refreshTokenEnc: encryptSecret(token.refreshToken),
      tokenExpireAt: token.expiresAt,
      status: 'normal',
      identity: 'matrix',
      stage: 'nurturing',
      lastActiveAt: new Date(),
    });
    const saved = await this.accountRepo.save(account);
    await this.logEvent(saved, 'connected', '首次授权绑定');
    this.logger.log(`OAuth 新建账号 #${saved.id} (${stateRow.platform})`);
    return {
      accountId: saved.id,
      platform: stateRow.platform,
      nickname: saved.nickname,
      mode: 'created',
    };
  }

  private async logEvent(
    account: AccountEntity,
    eventType: 'connected' | 'token_refreshed',
    detail: string,
  ): Promise<void> {
    await this.eventRepo.save(
      this.eventRepo.create({
        tenantId: account.tenantId,
        accountId: Number(account.id),
        eventType,
        detail,
      }),
    );
  }
}
