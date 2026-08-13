import { Injectable, Type } from '@nestjs/common';
import { MaterialService } from '../../g/g.service';
import {
  StrategyMeta,
  VideoChainContext,
  VideoStrategy,
  VideoStageResult,
} from '../video-automation.types';

/**
 * 素材阶段（G）5 策略：覆盖图文/视频/音乐/字幕/贴纸多素材类型。
 * 对每个脚本调用 MaterialService.generateMaterial（经 SkillGateway→LLM 生成）。
 */
@Injectable()
export class MaterialImageStrategy implements VideoStrategy {
  meta: StrategyMeta = {
    key: 'material_image',
    stage: 'material',
    name: '配图素材',
    tech: 'MaterialService.generateMaterial(type=image)',
    impl: 'llm',
    scenarios: ['hotspot', 'knowledge'],
    enabledByDefault: true,
    desc: '为脚本生成封面/配图素材',
  };
  constructor(private readonly material: MaterialService) {}
  async run(ctx: VideoChainContext): Promise<VideoStageResult> {
    const ids: number[] = [];
    for (const scriptId of ctx.scriptIds ?? []) {
      const entity = await this.material.generateMaterial({
        type: 'image',
        prompt: `为脚本#${scriptId}生成配图素材`,
        relatedScriptId: scriptId,
      });
      ids.push(entity.id);
    }
    return { strategy: this.meta.key, materialIds: ids };
  }
}

@Injectable()
export class MaterialVideoStrategy implements VideoStrategy {
  meta: StrategyMeta = {
    key: 'material_video',
    stage: 'material',
    name: '视频片段素材',
    tech: 'MaterialService.generateMaterial(type=video)',
    impl: 'llm',
    scenarios: ['hotspot', 'realtime'],
    enabledByDefault: true,
    desc: '为脚本生成可剪辑的视频片段素材',
  };
  constructor(private readonly material: MaterialService) {}
  async run(ctx: VideoChainContext): Promise<VideoStageResult> {
    const ids: number[] = [];
    for (const scriptId of ctx.scriptIds ?? []) {
      const entity = await this.material.generateMaterial({
        type: 'video',
        prompt: `为脚本#${scriptId}生成视频片段素材`,
        relatedScriptId: scriptId,
      });
      ids.push(entity.id);
    }
    return { strategy: this.meta.key, materialIds: ids };
  }
}

@Injectable()
export class MaterialMusicStrategy implements VideoStrategy {
  meta: StrategyMeta = {
    key: 'material_music',
    stage: 'material',
    name: '背景音乐素材',
    tech: 'MaterialService.generateMaterial(type=music)',
    impl: 'llm',
    scenarios: ['hotspot', 'ecommerce'],
    enabledByDefault: true,
    desc: '为脚本生成/匹配背景音乐素材',
  };
  constructor(private readonly material: MaterialService) {}
  async run(ctx: VideoChainContext): Promise<VideoStageResult> {
    const ids: number[] = [];
    for (const scriptId of ctx.scriptIds ?? []) {
      const entity = await this.material.generateMaterial({
        type: 'music',
        prompt: `为脚本#${scriptId}生成背景音乐素材`,
        relatedScriptId: scriptId,
      });
      ids.push(entity.id);
    }
    return { strategy: this.meta.key, materialIds: ids };
  }
}

@Injectable()
export class MaterialSubtitleStrategy implements VideoStrategy {
  meta: StrategyMeta = {
    key: 'material_subtitle',
    stage: 'material',
    name: '字幕文案素材',
    tech: 'MaterialService.generateMaterial(type=subtitle)',
    impl: 'llm',
    scenarios: ['knowledge', 'ecommerce'],
    enabledByDefault: true,
    desc: '为脚本生成字幕/花字文案素材',
  };
  constructor(private readonly material: MaterialService) {}
  async run(ctx: VideoChainContext): Promise<VideoStageResult> {
    const ids: number[] = [];
    for (const scriptId of ctx.scriptIds ?? []) {
      const entity = await this.material.generateMaterial({
        type: 'subtitle',
        prompt: `为脚本#${scriptId}生成字幕文案素材`,
        relatedScriptId: scriptId,
      });
      ids.push(entity.id);
    }
    return { strategy: this.meta.key, materialIds: ids };
  }
}

@Injectable()
export class MaterialStickerStrategy implements VideoStrategy {
  meta: StrategyMeta = {
    key: 'material_sticker',
    stage: 'material',
    name: '贴纸花字素材',
    tech: 'MaterialService.generateMaterial(type=sticker)',
    impl: 'llm',
    scenarios: ['hotspot', 'realtime'],
    enabledByDefault: true,
    desc: '为脚本生成贴纸/花字素材',
  };
  constructor(private readonly material: MaterialService) {}
  async run(ctx: VideoChainContext): Promise<VideoStageResult> {
    const ids: number[] = [];
    for (const scriptId of ctx.scriptIds ?? []) {
      const entity = await this.material.generateMaterial({
        type: 'sticker',
        prompt: `为脚本#${scriptId}生成贴纸花字素材`,
        relatedScriptId: scriptId,
      });
      ids.push(entity.id);
    }
    return { strategy: this.meta.key, materialIds: ids };
  }
}

export const MATERIAL_STRATEGIES: Type<VideoStrategy>[] = [
  MaterialImageStrategy,
  MaterialVideoStrategy,
  MaterialMusicStrategy,
  MaterialSubtitleStrategy,
  MaterialStickerStrategy,
];
