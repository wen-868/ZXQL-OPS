import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppError } from '../../shared/app-error';
import { TenantContext } from '../../tenant/tenant-context';
import { AccountEntity } from '../account/account.entity';
import { Platform } from '../account/account.types';
import { ScriptEntity } from '../script/script.entity';
import { VideoEntity } from '../h/video.entity';
import { PublishTaskEntity } from './publish.entity';
import { PublishStatus, PUBLISHABLE_SCRIPT_STATUSES } from './publish.types';
import { CreatePublishDto } from './dto/create-publish.dto';
import { BatchPublishDto } from './dto/batch-publish.dto';
import { DouyinClientService, DouyinApiError } from '../../integration/douyin-client.service';
import { decryptSecret } from '../../shared/crypto';
import { randomUUID } from 'crypto';

/**
 * 发布与分发服务（规划 §4-I）。
 * 消费 F 脚本（scriptId + attributionId 透传），按 B 账号多账号分发；
 * 发布前合规校验复用 F 脚本的 complianceRisk（高危拦截）；
 * - 抖音/快手平台：有 OAuth 凭证 → 走真实 API（DouyinClientService）；无凭证 → 降级模拟回执
 * - 其他平台：模拟回执（与阶段1行为一致）
 */
@Injectable()
export class PublishService {
  private readonly logger = new Logger(PublishService.name);

  constructor(
    @InjectRepository(PublishTaskEntity)
    private readonly publishRepo: Repository<PublishTaskEntity>,
    @InjectRepository(ScriptEntity)
    private readonly scriptRepo: Repository<ScriptEntity>,
    @InjectRepository(AccountEntity)
    private readonly accountRepo: Repository<AccountEntity>,
    @InjectRepository(VideoEntity)
    private readonly videoRepo: Repository<VideoEntity>,
    private readonly douyinClient: DouyinClientService,
  ) {}

  /** 一键分发（POST /api/ops/publish） */
  async publish(dto: CreatePublishDto): Promise<{ taskIds: number[]; traceId: string }> {
    const tenantId = TenantContext.requireTenantId();
    const traceId = TenantContext.getTraceId() ?? '';
    const ids: number[] = [];
    for (const accountId of dto.accountIds) {
      const task = await this.createTask(tenantId, {
        scriptId: dto.scriptId,
        accountId,
        platform: dto.platform,
        scheduledAt: dto.scheduledAt,
        cartProductId: dto.cartProductId,
        videoId: dto.videoId,
      });
      ids.push(task.id);
    }
    return { taskIds: ids, traceId };
  }

  /** 解析某平台在租户下的首个可用账号（供自动化投流免人工指定 accountIds） */
  async resolveDefaultAccount(platform: Platform): Promise<number | undefined> {
    const tenantId = TenantContext.requireTenantId();
    const acc = await this.accountRepo.findOne({
      where: { tenantId, platform },
      order: { id: 'ASC' },
    });
    return acc?.id;
  }

  /** 批量分发（POST /api/ops/publish/batch） */
  async batchPublish(dto: BatchPublishDto): Promise<{ taskIds: number[]; traceId: string }> {
    const tenantId = TenantContext.requireTenantId();
    const traceId = TenantContext.getTraceId() ?? '';
    const ids: number[] = [];
    for (const item of dto.tasks) {
      for (const accountId of item.accountIds) {
        const task = await this.createTask(tenantId, {
          scriptId: item.scriptId,
          accountId,
          platform: item.platform,
          scheduledAt: item.scheduledAt,
          cartProductId: item.cartProductId,
        });
        ids.push(task.id);
      }
    }
    return { taskIds: ids, traceId };
  }

  async getPublish(id: number): Promise<PublishTaskEntity> {
    const tenantId = TenantContext.requireTenantId();
    const task = await this.publishRepo.findOne({ where: { id, tenantId } });
    if (!task) throw new AppError('PUBLISH_NOT_FOUND');
    return task;
  }

  /** 挂车转化漏斗（GET /api/ops/publish/:id/funnel） */
  async getFunnel(id: number): Promise<{
    cartClicks: number;
    orderConv: number;
    conversionRate: number;
  }> {
    const task = await this.getPublish(id);
    const cartClicks = task.cartClicks ?? 0;
    const orderConv = task.orderConv ?? 0;
    const conversionRate = cartClicks > 0 ? Number((orderConv / cartClicks).toFixed(4)) : 0;
    return { cartClicks, orderConv, conversionRate };
  }

  // ---- 私有 ----

  private async createTask(
    tenantId: string,
    item: {
      scriptId: number;
      accountId: number;
      platform?: string;
      scheduledAt?: string;
      cartProductId?: string;
      videoId?: number;
    },
  ): Promise<PublishTaskEntity> {
    // 幂等：同租户+脚本+账号 已存在 published 任务则直接返回（防重复发）
    const existing = await this.publishRepo.findOne({
      where: {
        tenantId,
        scriptId: item.scriptId,
        accountId: item.accountId,
        status: PublishStatus.Published,
      },
    });
    if (existing) return existing;

    const script = await this.scriptRepo.findOne({ where: { id: item.scriptId, tenantId } });
    if (!script) throw new AppError('SCRIPT_NOT_FOUND');

    // 发布前合规校验：复用 F 脚本已算好的 complianceRisk（高危禁止发布）
    if (script.complianceRisk?.level === 'high') {
      throw new AppError('COMPLIANCE_BLOCKED');
    }
    if (!PUBLISHABLE_SCRIPT_STATUSES.includes(script.status as never)) {
      throw new AppError('SCRIPT_NOT_PUBLISHABLE');
    }

    const account = await this.accountRepo.findOne({ where: { id: item.accountId, tenantId } });
    if (!account) throw new AppError('PUBLISH_ACCOUNT_NOT_FOUND');
    if (item.platform && item.platform !== account.platform) {
      throw new AppError('PUBLISH_PLATFORM_MISMATCH');
    }

    const scheduledAt = item.scheduledAt ? new Date(item.scheduledAt) : null;

    // 尝试真实平台发布（抖音/快手），传递 videoId 以精确关联视频资产
    const publishResult = await this.tryPlatformPublish(
      account,
      script.title ?? script.content?.substring(0, 64) ?? '',
      script,
      item.videoId,
    );

    const task = this.publishRepo.create({
      tenantId,
      scriptId: item.scriptId,
      accountId: item.accountId,
      platform: account.platform,
      attributionId: script.attributionId,
      videoId: item.videoId ?? null,
      scheduledAt,
      status: publishResult.status,
      retryCount: publishResult.status === PublishStatus.Failed ? 1 : 0,
      extPostId: publishResult.extPostId,
      cartProductId: item.cartProductId ?? null,
      cartClicks: 0,
      orderConv: 0,
      publishedAt: publishResult.status === PublishStatus.Published ? new Date() : null,
      errorMsg: publishResult.errorMessage,
    } as Parameters<typeof this.publishRepo.create>[0]);
    return this.publishRepo.save(task);
  }

  /**
   * 尝试通过真实平台 API 发布（当前支持抖音）。
   * 有有效凭证 → 调 DouyinClientService；无 → 降级模拟回执。
   * 优先通过 videoId 精确查找视频资产，若无则回退到系统目录搜索最新 mp4。
   */
  private async tryPlatformPublish(
    account: AccountEntity,
    title: string,
    _script: ScriptEntity,
    videoId?: number,
  ): Promise<{
    status: PublishStatus;
    extPostId: string;
    errorMessage?: string;
  }> {
    const simulatedExtId = `pub_${account.tenantId ?? 't'}_${account.id}_${_script.id}`;

    // 非抖音账号 → 模拟回执
    if (account.platform !== 'douyin') {
      return {
        status: PublishStatus.Published,
        extPostId: simulatedExtId,
      };
    }

    // 抖音平台：检查是否有 API 凭证
    if (!this.douyinClient.isConfigured()) {
      this.logger.warn('Douyin client not configured, fallback to simulated publish');
      return {
        status: PublishStatus.Published,
        extPostId: simulatedExtId,
      };
    }

    // 检查账号是否有 OAuth 凭证
    let accessToken: string;
    try {
      if (!account.tokenEnc) throw new Error('no token');
      const decrypted = decryptSecret(account.tokenEnc);
      accessToken = decrypted;
    } catch {
      this.logger.warn(`Account ${account.id}: no valid OAuth token, fallback to simulated`);
      return {
        status: PublishStatus.Published,
        extPostId: simulatedExtId,
      };
    }

    const openId = account.platformOpenId;
    if (!openId) {
      this.logger.warn(`Account ${account.id}: no platformOpenId, fallback to simulated`);
      return {
        status: PublishStatus.Published,
        extPostId: simulatedExtId,
      };
    }

    // 视频文件：优先通过 videoId 精确查找，回退到系统目录搜索
    let videoFilePath: string | null = null;
    if (videoId) {
      try {
        const video = await this.videoRepo.findOne({ where: { id: videoId } });
        const localPath = video?.meta?.localPath;
        if (typeof localPath === 'string') {
          videoFilePath = localPath;
          this.logger.log(`Found video via videoId=${videoId}: ${localPath}`);
        }
      } catch (e) {
        this.logger.warn(`VideoEntity lookup failed for id=${videoId}: ${(e as Error).message}`);
      }
    }
    // 回退：查找 H 模块生成的最新视频
    if (!videoFilePath) {
      try {
        videoFilePath = await this.findLatestVideoFile();
      } catch (e) {
        this.logger.warn(`Cannot find video file: ${(e as Error).message}`);
      }
    }

    if (!videoFilePath) {
      this.logger.warn('No video file for douyin publish, fallback to simulated');
      return {
        status: PublishStatus.Published,
        extPostId: simulatedExtId,
      };
    }

    // 真实 API 发布
    try {
      const result = await this.douyinClient.publishVideo(
        accessToken,
        openId,
        videoFilePath,
        title,
      );
      this.logger.log(`Douyin publish success: itemId=${result.itemId}`);
      return {
        status: PublishStatus.Published,
        extPostId: `dy_${result.itemId}`,
      };
    } catch (e) {
      if (e instanceof DouyinApiError) {
        this.logger.error(
          `Douyin API error: ${e.message} (${e.errorCode}/${e.subErrorCode}) logid=${e.logid}`,
        );
        return {
          status: PublishStatus.Failed,
          extPostId: `dy_err_${randomUUID().substring(0, 8)}`,
          errorMessage: `Douyin[${e.errorCode}]: ${e.message}`,
        };
      }
      this.logger.error(`Douyin publish unexpected: ${(e as Error).message}`);
      // 真实发布失败不降级模拟——业务上要求明确知道发布是否成功
      throw new AppError('PUBLISH_DOUYIN_API_ERROR');
    }
  }

  /**
   * 查找本地最新的视频文件路径（供 douyin 上传用）。
   * 搜索 H 模块生成的 temp 目录下的 mp4 文件。
   */
  private async findLatestVideoFile(): Promise<string | null> {
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');
    const tempDir = path.join(os.tmpdir(), 'zhixiang-ops-videos');
    if (!fs.existsSync(tempDir)) return null;
    const files = fs.readdirSync(tempDir).filter((f) => f.endsWith('.mp4'));
    if (files.length === 0) return null;
    // 按修改时间排序，取最新
    files.sort((a, b) => {
      const ta = fs.statSync(path.join(tempDir, a)).mtimeMs;
      const tb = fs.statSync(path.join(tempDir, b)).mtimeMs;
      return tb - ta;
    });
    return path.join(tempDir, files[0]);
  }
}
