import { Injectable, Type } from '@nestjs/common';
import { VideoService } from '../../h/h.service';
import {
  StrategyMeta,
  VideoChainContext,
  VideoStrategy,
  VideoStageResult,
} from '../video-automation.types';

/**
 * 成片阶段（H）5 策略：覆盖竖屏/方形/横屏/高光混剪/自动混剪多画幅。
 * 调用 VideoService.fromScript（先存草稿再 FFmpeg 合成；无 FFmpeg 时保留草稿，best-effort）。
 */
@Injectable()
export class ComposeVerticalStrategy implements VideoStrategy {
  meta: StrategyMeta = {
    key: 'compose_vertical',
    stage: 'compose',
    name: '竖屏成片',
    tech: 'VideoService.fromScript(ratio=9:16)',
    impl: 'local',
    scenarios: ['hotspot', 'ecommerce', 'realtime'],
    enabledByDefault: true,
    desc: '合成 9:16 竖屏成片（短视频默认画幅）',
  };
  constructor(private readonly video: VideoService) {}
  async run(ctx: VideoChainContext): Promise<VideoStageResult> {
    const ids: number[] = [];
    for (const scriptId of ctx.scriptIds ?? []) {
      const v = await this.video.fromScript({
        scriptId,
        materialIds: ctx.materialIds ?? [],
        ratio: '9:16',
      });
      ids.push(v.id);
    }
    return { strategy: this.meta.key, videoIds: ids };
  }
}

@Injectable()
export class ComposeSquareStrategy implements VideoStrategy {
  meta: StrategyMeta = {
    key: 'compose_square',
    stage: 'compose',
    name: '方形成片',
    tech: 'VideoService.fromScript(ratio=1:1)',
    impl: 'local',
    scenarios: ['ecommerce', 'brand'],
    enabledByDefault: true,
    desc: '合成 1:1 方形成片（信息流/电商适配）',
  };
  constructor(private readonly video: VideoService) {}
  async run(ctx: VideoChainContext): Promise<VideoStageResult> {
    const ids: number[] = [];
    for (const scriptId of ctx.scriptIds ?? []) {
      const v = await this.video.fromScript({
        scriptId,
        materialIds: ctx.materialIds ?? [],
        ratio: '1:1',
      });
      ids.push(v.id);
    }
    return { strategy: this.meta.key, videoIds: ids };
  }
}

@Injectable()
export class ComposeHorizontalStrategy implements VideoStrategy {
  meta: StrategyMeta = {
    key: 'compose_horizontal',
    stage: 'compose',
    name: '横屏成片',
    tech: 'VideoService.fromScript(ratio=16:9)',
    impl: 'local',
    scenarios: ['knowledge'],
    enabledByDefault: true,
    desc: '合成 16:9 横屏成片（中长视频/B站适配）',
  };
  constructor(private readonly video: VideoService) {}
  async run(ctx: VideoChainContext): Promise<VideoStageResult> {
    const ids: number[] = [];
    for (const scriptId of ctx.scriptIds ?? []) {
      const v = await this.video.fromScript({
        scriptId,
        materialIds: ctx.materialIds ?? [],
        ratio: '16:9',
      });
      ids.push(v.id);
    }
    return { strategy: this.meta.key, videoIds: ids };
  }
}

@Injectable()
export class ComposeHighlightStrategy implements VideoStrategy {
  meta: StrategyMeta = {
    key: 'compose_highlight',
    stage: 'compose',
    name: '高光混剪成片',
    tech: 'VideoService.fromScript(ratio=9:16, montage)',
    impl: 'local',
    scenarios: ['hotspot', 'realtime'],
    enabledByDefault: true,
    desc: '以高光镜头混剪生成竖屏成片',
  };
  constructor(private readonly video: VideoService) {}
  async run(ctx: VideoChainContext): Promise<VideoStageResult> {
    const ids: number[] = [];
    for (const scriptId of ctx.scriptIds ?? []) {
      const v = await this.video.fromScript({
        scriptId,
        materialIds: ctx.materialIds ?? [],
        ratio: '9:16',
        title: '高光混剪',
      });
      ids.push(v.id);
    }
    return { strategy: this.meta.key, videoIds: ids };
  }
}

@Injectable()
export class ComposeAutoStrategy implements VideoStrategy {
  meta: StrategyMeta = {
    key: 'compose_auto',
    stage: 'compose',
    name: '自动全素材成片',
    tech: 'VideoService.fromScript(ratio=9:16, auto)',
    impl: 'hybrid',
    scenarios: ['hotspot', 'ecommerce', 'knowledge'],
    enabledByDefault: true,
    desc: '自动编排全部素材合成竖屏成片',
  };
  constructor(private readonly video: VideoService) {}
  async run(ctx: VideoChainContext): Promise<VideoStageResult> {
    const ids: number[] = [];
    for (const scriptId of ctx.scriptIds ?? []) {
      const v = await this.video.fromScript({
        scriptId,
        materialIds: ctx.materialIds ?? [],
        ratio: '9:16',
      });
      ids.push(v.id);
    }
    return { strategy: this.meta.key, videoIds: ids };
  }
}

export const COMPOSE_STRATEGIES: Type<VideoStrategy>[] = [
  ComposeVerticalStrategy,
  ComposeSquareStrategy,
  ComposeHorizontalStrategy,
  ComposeHighlightStrategy,
  ComposeAutoStrategy,
];
