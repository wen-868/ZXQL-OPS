import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { TenantContext } from '../../tenant/tenant-context';
import { OpsStrategyRegistry } from './ops-strategy.registry';
import { OPS_STRATEGY_TOKEN } from './ops-automation.constants';
import { OpsChainContext, OpsStage, OpsStageResult, OpsStrategy } from './ops-automation.types';

/**
 * 运营全链路自动化编排器（免人工干预）。
 * 串联 检索→筛选→上架→投流→验证 五阶段，每阶段从注册表选择策略执行；
 * 上下文(ctx)沿链透传 assetId；验证阶段产出回流 D 再分析形成闭环。
 * 提供：手动 runOnce、按 tenant 定时 cron、tenant 策略偏好配置。
 */
@Injectable()
export class AutoChainService implements OnModuleInit {
  private readonly logger = new Logger(AutoChainService.name);

  /** tenantId -> 各阶段偏好策略 key */
  private readonly tenantPref = new Map<string, Partial<Record<OpsStage, string>>>();
  /** 历史运行记录（运行时内存，可接 M 看板） */
  private readonly runs: Array<{ id: string; tenantId: string; at: Date; stage: string }> = [];

  constructor(
    private readonly registry: OpsStrategyRegistry,
    @Inject(OPS_STRATEGY_TOKEN) private readonly strategies: OpsStrategy[],
  ) {}

  onModuleInit(): void {
    // 统一注册所有策略实例（覆盖五阶段，每阶段 ≥5）
    this.registry.registerAll(this.strategies);
    const counts: Record<string, number> = {};
    for (const s of ['retrieve', 'screen', 'publish-up', 'deliver', 'verify'] as OpsStage[]) {
      counts[s] = this.registry.countByStage(s);
    }
    this.logger.log(`运营自动化策略注册完成：${JSON.stringify(counts)}（每阶段应≥5）`);
    // 阶段覆盖度自检
    for (const [stage, n] of Object.entries(counts)) {
      if (n < 5) {
        this.logger.warn(`阶段 ${stage} 策略数 ${n} < 5，未满足全覆盖要求`);
      }
    }
  }

  /** 配置某 tenant 的阶段策略偏好 */
  setTenantPreference(tenantId: string, pref: Partial<Record<OpsStage, string>>): void {
    this.tenantPref.set(tenantId, { ...(this.tenantPref.get(tenantId) ?? {}), ...pref });
  }

  /** 全链路一次性运行（免人工干预核心入口） */
  async runOnce(
    tenantId: string,
    preferred?: Partial<Record<OpsStage, string>>,
  ): Promise<{
    chainRunId: string;
    stages: Record<
      string,
      { strategy: string; ok: boolean; detail?: OpsStageResult; error?: string }
    >;
  }> {
    const pref = { ...(this.tenantPref.get(tenantId) ?? {}), ...(preferred ?? {}) };
    const chainRunId = randomUUID();
    const ctx: OpsChainContext = { tenantId, chainRunId };

    // 在租户上下文中运行整条链路，供被调用服务读取 tenantId（请求作用域隔离）
    return TenantContext.run({ traceId: chainRunId, tenantId, type: 'automation' }, async () => {
      const stages = ['retrieve', 'screen', 'publish-up', 'deliver', 'verify'] as OpsStage[];
      const report: Record<
        string,
        { strategy: string; ok: boolean; detail?: OpsStageResult; error?: string }
      > = {};

      for (const stage of stages) {
        const strategy = this.registry.resolve(stage, pref[stage]);
        this.runs.push({ id: chainRunId, tenantId, at: new Date(), stage });
        try {
          const detail = await strategy.run(ctx, {});
          // 把各阶段产物写回 ctx，供后续阶段与验证闭环使用
          this.absorb(stage, ctx, detail);
          report[stage] = { strategy: strategy.meta.key, ok: true, detail };
        } catch (e) {
          report[stage] = {
            strategy: strategy.meta.key,
            ok: false,
            error: e instanceof Error ? e.message : String(e),
          };
          // 单阶段失败不中断全链路：继续后续阶段（隔离）
          this.logger.warn(`[${chainRunId}] 阶段 ${stage} 失败：${(e as Error).message}`);
        }
      }
      this.logger.log(`[${chainRunId}] 全链路运行完成：5 阶段`);
      return { chainRunId, stages: report };
    });
  }

  /** 定时全量运行（每 10 分钟对所有已配置 tenant 跑一遍） */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async scheduledRun(): Promise<void> {
    const tenants = [...this.tenantPref.keys()];
    for (const tenantId of tenants) {
      try {
        await this.runOnce(tenantId);
      } catch (e) {
        this.logger.error(`定时全链路失败 tenant=${tenantId}: ${(e as Error).message}`);
      }
    }
  }

  /** 把阶段产出吸收进 ctx */
  private absorb(stage: OpsStage, ctx: OpsChainContext, detail: OpsStageResult): void {
    switch (stage) {
      case 'retrieve':
        ctx.collectTaskIds = detail?.collectTaskIds ?? ctx.collectTaskIds;
        break;
      case 'screen':
        ctx.topicIds = detail?.topicIds ?? ctx.topicIds;
        break;
      case 'publish-up':
        ctx.scriptIds = detail?.scriptIds ?? ctx.scriptIds;
        break;
      case 'deliver':
        ctx.publishTaskIds = detail?.publishTaskIds ?? ctx.publishTaskIds;
        break;
      case 'verify':
        ctx.recycleTaskIds = detail?.recycleTaskIds ?? ctx.recycleTaskIds;
        break;
    }
  }

  listRuns(): Array<{ id: string; tenantId: string; at: Date; stage: string }> {
    return this.runs.slice(-50);
  }
}
