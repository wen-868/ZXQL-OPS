import { Injectable, Logger } from '@nestjs/common';
import { OpsStage, OpsStrategy, OpsStrategy as _S, StrategyMeta } from './ops-automation.types';

/**
 * 运营自动化策略注册表（单例注入）。
 * 各阶段的多种实现方案在模块初始化时 register 进来；运行时按 tenant 偏好
 * 或 auto 选择策略执行。满足"同一功能领域多个实现方案 + 多维度覆盖"。
 */
@Injectable()
export class OpsStrategyRegistry {
  private readonly logger = new Logger(OpsStrategyRegistry.name);
  /** key -> strategy */
  private readonly byKey = new Map<string, OpsStrategy>();
  /** stage -> keys */
  private readonly byStage = new Map<string, string[]>();

  register(strategy: OpsStrategy): void {
    const { key, stage } = strategy.meta;
    if (this.byKey.has(key)) {
      this.logger.warn(`策略重复注册，覆盖：${key}`);
    }
    this.byKey.set(key, strategy);
    const arr = this.byStage.get(stage) ?? [];
    if (!arr.includes(key)) arr.push(key);
    this.byStage.set(stage, arr);
  }

  /** 批量注册（数组声明式） */
  registerAll(strategies: OpsStrategy[]): void {
    for (const s of strategies) this.register(s);
  }

  get(key: string): OpsStrategy | undefined {
    return this.byKey.get(key);
  }

  listByStage(stage: OpsStage): OpsStrategy[] {
    return (this.byStage.get(stage) ?? []).map((k) => this.byKey.get(k)!).filter(Boolean);
  }

  listMetas(): StrategyMeta[] {
    return [...this.byKey.values()].map((s) => s.meta);
  }

  metasByStage(stage: OpsStage): StrategyMeta[] {
    return this.listByStage(stage).map((s) => s.meta);
  }

  /** 按 tenant 偏好选择策略；缺省时取该阶段第 1 个已注册策略 */
  resolve(stage: OpsStage, preferredKey?: string): OpsStrategy {
    if (preferredKey) {
      const s = this.byKey.get(preferredKey);
      if (s && s.meta.stage === stage) return s;
    }
    const list = this.listByStage(stage);
    if (list.length === 0) {
      throw new Error(`阶段 ${stage} 无可注册策略`);
    }
    return list[0];
  }

  /** 阶段内所有策略数量（用于校验"≥5"覆盖度） */
  countByStage(stage: OpsStage): number {
    return this.listByStage(stage).length;
  }
}
