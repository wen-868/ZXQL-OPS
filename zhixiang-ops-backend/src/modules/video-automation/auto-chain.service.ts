import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { TenantContext } from '../../tenant/tenant-context';
import { VideoStrategyRegistry } from './video-strategy.registry';
import { VIDEO_STRATEGY_TOKEN } from './video-automation.constants';
import {
  VideoChainContext,
  VideoStage,
  VideoStrategy,
  VideoStageResult,
  VIDEO_STAGES,
} from './video-automation.types';

/**
 * 视频全链路自动化编排器（免人工干预）。
 * 串联 情报(C)→人性分析(D)→选题(E)→脚本(F)→素材(G)→成片(H)→发布投流(I)→数据回收验证(L)
 * 共 8 阶段，每阶段从注册表选择策略执行；产品沿 ctx 透传形成闭环。
 * 提供：手动 runOnce、按 tenant 定时 cron、tenant 策略偏好配置。
 */
@Injectable()
export class VideoAutoChainService implements OnModuleInit {
  private readonly logger = new Logger(VideoAutoChainService.name);

  /** tenantId -> 各阶段偏好策略 key */
  private readonly tenantPref = new Map<string, Partial<Record<VideoStage, string>>>();
  /** 历史运行记录（运行时内存，可接 M 看板） */
  private readonly runs: Array<{ id: string; tenantId: string; at: Date; stage: string }> = [];

  constructor(
    private readonly registry: VideoStrategyRegistry,
    @Inject(VIDEO_STRATEGY_TOKEN) private readonly strategies: VideoStrategy[],
  ) {}

  onModuleInit(): void {
    this.registry.registerAll(this.strategies);
    const counts: Record<string, number> = {};
    for (const s of VIDEO_STAGES) counts[s] = this.registry.countByStage(s);
    this.logger.log(`视频自动化策略注册完成：${JSON.stringify(counts)}（每阶段应≥5）`);
    for (const [stage, n] of Object.entries(counts)) {
      if (n < 5) this.logger.warn(`阶段 ${stage} 策略数 ${n} < 5，未满足全覆盖要求`);
    }
  }

  setTenantPreference(tenantId: string, pref: Partial<Record<VideoStage, string>>): void {
    this.tenantPref.set(tenantId, { ...(this.tenantPref.get(tenantId) ?? {}), ...pref });
  }

  async runOnce(
    tenantId: string,
    preferred?: Partial<Record<VideoStage, string>>,
  ): Promise<{
    chainRunId: string;
    stages: Record<
      string,
      { strategy: string; ok: boolean; detail?: VideoStageResult; error?: string }
    >;
  }> {
    const pref = { ...(this.tenantPref.get(tenantId) ?? {}), ...(preferred ?? {}) };
    const chainRunId = randomUUID();
    const ctx: VideoChainContext = { tenantId, chainRunId };

    return TenantContext.run({ traceId: chainRunId, tenantId, type: 'automation' }, async () => {
      const report: Record<
        string,
        { strategy: string; ok: boolean; detail?: VideoStageResult; error?: string }
      > = {};

      for (const stage of VIDEO_STAGES) {
        const strategy = this.registry.resolve(stage, pref[stage]);
        this.runs.push({ id: chainRunId, tenantId, at: new Date(), stage });
        if (!strategy) {
          report[stage] = { strategy: 'none', ok: false, error: 'no strategy registered' };
          continue;
        }
        try {
          const detail = await strategy.run(ctx, {});
          this.absorb(stage, ctx, detail);
          report[stage] = { strategy: strategy.meta.key, ok: true, detail };
        } catch (e) {
          report[stage] = {
            strategy: strategy.meta.key,
            ok: false,
            error: e instanceof Error ? e.message : String(e),
          };
          this.logger.warn(`[${chainRunId}] 阶段 ${stage} 失败：${(e as Error).message}`);
        }
      }
      this.logger.log(`[${chainRunId}] 视频全链路运行完成：${VIDEO_STAGES.length} 阶段`);
      return { chainRunId, stages: report };
    });
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async scheduledRun(): Promise<void> {
    for (const tenantId of [...this.tenantPref.keys()]) {
      try {
        await this.runOnce(tenantId);
      } catch (e) {
        this.logger.error(`定时视频全链路失败 tenant=${tenantId}: ${(e as Error).message}`);
      }
    }
  }

  private absorb(stage: VideoStage, ctx: VideoChainContext, detail: VideoStageResult): void {
    switch (stage) {
      case 'intel':
        ctx.collectTaskIds = detail?.collectTaskIds ?? ctx.collectTaskIds;
        break;
      case 'analyze':
        ctx.analysisTaskIds = detail?.analysisTaskIds ?? ctx.analysisTaskIds;
        break;
      case 'topic':
        ctx.topicIds = detail?.topicIds ?? ctx.topicIds;
        break;
      case 'script':
        ctx.scriptIds = detail?.scriptIds ?? ctx.scriptIds;
        break;
      case 'material':
        ctx.materialIds = detail?.materialIds ?? ctx.materialIds;
        break;
      case 'compose':
        ctx.videoIds = detail?.videoIds ?? ctx.videoIds;
        break;
      case 'publish':
        ctx.publishTaskIds = detail?.publishTaskIds ?? ctx.publishTaskIds;
        break;
      case 'recycle':
        ctx.recycleTaskIds = detail?.recycleTaskIds ?? ctx.recycleTaskIds;
        break;
    }
  }

  listRuns(): Array<{ id: string; tenantId: string; at: Date; stage: string }> {
    return this.runs.slice(-50);
  }
}
