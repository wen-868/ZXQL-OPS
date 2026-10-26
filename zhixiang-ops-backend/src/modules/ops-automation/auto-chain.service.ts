import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { TenantContext } from '../../tenant/tenant-context';
import { AnalyzeService } from '../analyze/analyze.service';
import { IntelService } from '../intel/intel.service';
import { OpsStrategyRegistry } from './ops-strategy.registry';
import { OPS_STRATEGY_TOKEN } from './ops-automation.constants';
import { OpsChainContext, OpsStage, OpsStageResult, OpsStrategy } from './ops-automation.types';

/**
 * 运营全链路自动化编排器（免人工干预）。
 * 串联 检索→筛选→上架→投流→验证 五阶段，每阶段从注册表选择策略执行；
 * 上下文(ctx)沿链透传 assetId；验证阶段产出回流 D 再分析形成闭环。
 * 全自动衔接（断点补完）：
 * - retrieve 建任务后等待 worker 完成（轮询 collectTask，超时 90s）
 * - screen 前自动触发 D 分析（消费已审核通过评论），等待完成后再选题
 * - deliver/verify 无输入时标记 skipped 而非静默成功
 * 提供：手动 runOnce、按 tenant 定时 cron、tenant 策略偏好配置。
 */
@Injectable()
export class AutoChainService implements OnModuleInit {
  private readonly logger = new Logger(AutoChainService.name);

  /** 采集任务等待超时（含 worker 5s 轮询节奏） */
  private static readonly WAIT_COLLECT_MS = 90_000;
  /** 分析任务等待超时 */
  private static readonly WAIT_ANALYZE_MS = 90_000;
  private static readonly POLL_MS = 2_000;

  /** tenantId -> 各阶段偏好策略 key */
  private readonly tenantPref = new Map<string, Partial<Record<OpsStage, string>>>();
  /** 历史运行记录（运行时内存，可接 M 看板） */
  private readonly runs: Array<{ id: string; tenantId: string; at: Date; stage: string }> = [];

  constructor(
    private readonly registry: OpsStrategyRegistry,
    @Inject(OPS_STRATEGY_TOKEN) private readonly strategies: OpsStrategy[],
    private readonly intelService: IntelService,
    private readonly analyzeService: AnalyzeService,
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

  /** 全链路一次性运行（免人工干预核心入口；支持阶段筛选，如只跑第一段 检索→筛选） */
  async runOnce(
    tenantId: string,
    preferred?: Partial<Record<OpsStage, string>>,
    stages?: OpsStage[],
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
      const all = ['retrieve', 'screen', 'publish-up', 'deliver', 'verify'] as OpsStage[];
      const selected = stages && stages.length ? stages : all;
      const report: Record<
        string,
        { strategy: string; ok: boolean; detail?: OpsStageResult; error?: string }
      > = {};

      for (const stage of selected) {
        await this.runStage(stage, ctx, pref, report);
        // 阶段间自动衔接：检索建的任务等 worker 完成后，数据才可被下游消费
        if (stage === 'retrieve' && ctx.collectTaskIds?.length) {
          await this.waitCollectTasksDone(ctx.collectTaskIds);
        }
      }

      await this.ensureAutoAnalysis(selected, ctx, report);

      this.logger.log(`[${chainRunId}] 链路运行完成：${selected.length} 阶段`);
      return { chainRunId, stages: report };
    });
  }

  /** 单阶段执行：产物写回 ctx；失败记入 report 但不中断链路（阶段隔离） */
  private async runStage(
    stage: OpsStage,
    ctx: OpsChainContext,
    pref: Partial<Record<OpsStage, string>>,
    report: Record<
      string,
      { strategy: string; ok: boolean; detail?: OpsStageResult; error?: string }
    >,
  ): Promise<void> {
    const strategy = this.registry.resolve(stage, pref[stage]);
    this.runs.push({ id: ctx.chainRunId ?? '', tenantId: ctx.tenantId, at: new Date(), stage });
    try {
      const detail = await strategy.run(ctx, {});
      this.absorb(stage, ctx, detail);
      report[stage] = { strategy: strategy.meta.key, ok: true, detail };
    } catch (e) {
      report[stage] = {
        strategy: strategy.meta.key,
        ok: false,
        error: AutoChainService.errText(e),
      };
      this.logger.warn(`[${ctx.chainRunId}] 阶段 ${stage} 失败：${AutoChainService.errText(e)}`);
    }
  }

  /**
   * 自动 D 分析衔接：本链要跑 screen（选题依赖洞察）且无既有分析任务时触发，
   * 等 worker 完成后再进 screen，保证「采集→分析→选题」无人工断点；失败降级读旧洞察库。
   */
  private async ensureAutoAnalysis(
    selected: OpsStage[],
    ctx: OpsChainContext,
    report: Record<
      string,
      { strategy: string; ok: boolean; detail?: OpsStageResult; error?: string }
    >,
  ): Promise<void> {
    if (!selected.includes('screen') || ctx.analysisTaskIds?.length) return;
    try {
      const { taskId } = await this.analyzeService.createAnalysisTask({ commentLimit: 200 });
      this.runs.push({
        id: ctx.chainRunId ?? '',
        tenantId: ctx.tenantId,
        at: new Date(),
        stage: 'analyze',
      });
      await this.waitAnalysisDone(taskId);
      ctx.analysisTaskIds = [taskId];
      report['analyze'] = {
        strategy: 'auto_analysis',
        ok: true,
        detail: { analysisTaskIds: [taskId] },
      };
      this.logger.log(`[${ctx.chainRunId}] 自动分析完成：task#${taskId}`);
    } catch (e) {
      report['analyze'] = {
        strategy: 'auto_analysis',
        ok: false,
        error: AutoChainService.errText(e),
      };
      this.logger.warn(
        `[${ctx.chainRunId}] 自动分析失败（降级旧洞察库）：${AutoChainService.errText(e)}`,
      );
    }
  }

  /** 异常 → 可读文本（catch 不假设一定是 Error） */
  private static errText(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
  }

  /** 等待采集任务全部结束（done/failed/cancelled），超时放弃 */
  private async waitCollectTasksDone(
    taskIds: number[],
    timeoutMs = AutoChainService.WAIT_COLLECT_MS,
  ): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    for (const id of taskIds) {
      while (Date.now() < deadline) {
        const t = await this.intelService.getCollectTask(id);
        if (['done', 'failed', 'cancelled'].includes(t.status)) break;
        await this.sleep(AutoChainService.POLL_MS);
      }
    }
  }

  /** 等待分析任务完成（done/failed），超时放弃 */
  private async waitAnalysisDone(
    taskId: number,
    timeoutMs = AutoChainService.WAIT_ANALYZE_MS,
  ): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const t = await this.analyzeService.getAnalysisTask(taskId);
      if (t.status === 'done' || t.status === 'failed') return;
      await this.sleep(AutoChainService.POLL_MS);
    }
    throw new Error(`分析任务 #${taskId} 等待超时`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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

  /**
   * 阶段产出槽位映射（阶段 → ctx/结果字段名，与 video-automation 同一范式）。
   * 数据驱动替代 switch 分支，absorb 圈复杂度 16 → ~4。
   */
  private static readonly STAGE_FIELD: Partial<Record<OpsStage, keyof OpsChainContext>> = {
    retrieve: 'collectTaskIds',
    screen: 'topicIds',
    'publish-up': 'scriptIds',
    deliver: 'publishTaskIds',
    verify: 'recycleTaskIds',
  };

  /** 把阶段产出吸收进 ctx（结果字段优先，未产出时保留既有值） */
  private absorb(stage: OpsStage, ctx: OpsChainContext, detail: OpsStageResult): void {
    const field = AutoChainService.STAGE_FIELD[stage];
    if (!field) return;
    const c = ctx as unknown as Record<string, unknown>;
    const d = (detail ?? {}) as unknown as Record<string, unknown>;
    c[field as string] = d[field as string] ?? c[field as string];
  }

  listRuns(): Array<{ id: string; tenantId: string; at: Date; stage: string }> {
    return this.runs.slice(-50);
  }
}
