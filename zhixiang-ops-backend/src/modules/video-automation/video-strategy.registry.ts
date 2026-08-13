import { Injectable } from '@nestjs/common';
import { StrategyMeta, VideoStage, VideoStrategy } from './video-automation.types';

/**
 * 视频全链路策略注册表。
 * 各阶段策略实例在模块 onModuleInit 时统一登记，编排器按阶段选择执行。
 */
@Injectable()
export class VideoStrategyRegistry {
  private readonly byStage = new Map<VideoStage, VideoStrategy[]>();

  registerAll(strategies: VideoStrategy[]): void {
    for (const s of strategies) {
      const arr = this.byStage.get(s.meta.stage) ?? [];
      arr.push(s);
      this.byStage.set(s.meta.stage, arr);
    }
  }

  list(): VideoStrategy[] {
    return [...this.byStage.values()].flat();
  }

  metas(): StrategyMeta[] {
    return this.list().map((s) => s.meta);
  }

  metasByStage(stage: VideoStage): StrategyMeta[] {
    return (this.byStage.get(stage) ?? []).map((s) => s.meta);
  }

  countByStage(stage: VideoStage): number {
    return this.byStage.get(stage)?.length ?? 0;
  }

  count(): number {
    return this.list().length;
  }

  resolve(stage: VideoStage, key?: string): VideoStrategy | undefined {
    const arr = this.byStage.get(stage) ?? [];
    if (key) return arr.find((s) => s.meta.key === key);
    return arr[0];
  }
}
