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
 * 平台发布结果。
 * simulated=true 表示**未真实推送到平台**（凭证缺失/未接入通道时的降级回执），
 * 业务上仍标记 Published 以保持链路可跑，但数据层面必须可区分，
 * 避免把模拟数据当真实经营结果（对账/回收/看板口径）。
 */
interface PublishResult {
  status: PublishStatus;
  extPostId: string;
  errorMessage?: string;
  simulated?: boolean;
  simulatedReason?: string;
}

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

  /** createTask 入参（单条发布任务描述） */
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

    const ctx = await this.validatePublishInput(tenantId, item);
    const publishResult = await this.tryPlatformPublish(
      ctx.account,
      ctx.script.title ?? ctx.script.content?.substring(0, 64) ?? '',
      ctx.script,
      item.videoId,
    );
    return this.saveTask(tenantId, item, ctx, publishResult);
  }

  /** 发布前置校验：脚本可发布性 + 账号存在/平台匹配（异常统一在此抛出） */
  private async validatePublishInput(
    tenantId: string,
    item: { scriptId: number; accountId: number; platform?: string },
  ): Promise<{ script: ScriptEntity; account: AccountEntity }> {
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
    return { script, account };
  }

  /** 发布任务实体构造与落库（状态/时间/模拟标记的字段映射集中一处） */
  private async saveTask(
    tenantId: string,
    item: {
      scriptId: number;
      accountId: number;
      scheduledAt?: string;
      cartProductId?: string;
      videoId?: number;
    },
    ctx: { script: ScriptEntity; account: AccountEntity },
    publishResult: PublishResult,
  ): Promise<PublishTaskEntity> {
    const scheduledAt = item.scheduledAt ? new Date(item.scheduledAt) : null;
    const task = this.publishRepo.create({
      tenantId,
      scriptId: item.scriptId,
      accountId: item.accountId,
      platform: ctx.account.platform,
      attributionId: ctx.script.attributionId,
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
      // 模拟发布标记落库：对账/回收看板据此区分「真实回执」与「降级模拟」
      simulated: publishResult.simulated ? 1 : 0,
      simulatedReason: publishResult.simulatedReason ?? null,
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
  ): Promise<PublishResult> {
    const simulatedExtId = `pub_${account.tenantId ?? 't'}_${account.id}_${_script.id}`;
    /** 模拟回执构造：统一标记 simulated，避免与真实平台回执混淆（审计/对账可区分） */
    const simulated = (reason: string): PublishResult => {
      this.logger.warn(`[publish] 降级为模拟发布（${reason}），未真实推送到平台`);
      return {
        status: PublishStatus.Published,
        extPostId: simulatedExtId,
        simulated: true,
        simulatedReason: reason,
      };
    };

    // 非抖音账号 → 模拟回执
    if (account.platform !== 'douyin') {
      return simulated(`平台 ${account.platform} 未接入真实发布通道`);
    }

    // 抖音平台：检查是否有 API 凭证
    if (!this.douyinClient.isConfigured()) {
      return simulated('抖音开放平台凭证未配置');
    }

    const accessToken = this.resolveAccessToken(account);
    if (!accessToken) return simulated(`账号 ${account.id} 无有效 OAuth Token`);

    const openId = account.platformOpenId;
    if (!openId) {
      return simulated(`账号 ${account.id} 缺少 platformOpenId`);
    }

    // 视频文件：优先通过 videoId 精确查找，回退到系统目录搜索（均失败则降级模拟）
    const videoFilePath = await this.resolveVideoFile(videoId);
    if (!videoFilePath) {
      return simulated('未找到可发布的视频文件');
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
        simulated: false,
      };
    } catch (e) {
      return this.mapDouyinPublishError(e);
    }
  }

  /** 解密账号 OAuth Token；无 token/解密失败返回 null（调用方据此降级） */
  private resolveAccessToken(account: AccountEntity): string | null {
    if (!account.tokenEnc) return null;
    try {
      return decryptSecret(account.tokenEnc);
    } catch {
      this.logger.warn(`Account ${account.id}: OAuth token 解密失败`);
      return null;
    }
  }

  /** 按 videoId 精确查找成片本地路径（未命中/异常返回 null） */
  private async resolveVideoPath(videoId?: number): Promise<string | null> {
    if (!videoId) return null;
    try {
      const video = await this.videoRepo.findOne({ where: { id: videoId } });
      const localPath = video?.meta?.localPath;
      if (typeof localPath === 'string') {
        this.logger.log(`Found video via videoId=${videoId}: ${localPath}`);
        return localPath;
      }
    } catch (e) {
      this.logger.warn(`VideoEntity lookup failed for id=${videoId}: ${(e as Error).message}`);
    }
    return null;
  }

  /**
   * 解析待发布视频：videoId 精确查找优先，未命中回退系统目录搜索最新 mp4。
   * 查找异常一律降级为 null（由调用方转模拟回执），不阻断发布链路。
   */
  private async resolveVideoFile(videoId?: number): Promise<string | null> {
    const exact = await this.resolveVideoPath(videoId);
    if (exact) return exact;
    try {
      return await this.findLatestVideoFile();
    } catch (e) {
      this.logger.warn(`Cannot find video file: ${(e as Error).message}`);
      return null;
    }
  }

  /** 抖音发布异常映射：平台错误 → Failed 回执；其他异常 → 明确抛错（不静默降级） */
  private mapDouyinPublishError(e: unknown): PublishResult {
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
