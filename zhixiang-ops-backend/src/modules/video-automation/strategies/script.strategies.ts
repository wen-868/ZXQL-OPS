import { Injectable, Type } from '@nestjs/common';
import { ScriptService } from '../../script/script.service';
import {
  StrategyMeta,
  VideoChainContext,
  VideoStrategy,
  VideoStageResult,
} from '../video-automation.types';

/**
 * 脚本阶段（F）5 策略：覆盖钩子驱动/故事带货/知识讲解/悬念开场/合规安全多模板。
 * 对每个选题调用 ScriptService.generateScript（经 SkillGateway→LLM 生成）。
 */
@Injectable()
export class ScriptHookStrategy implements VideoStrategy {
  meta: StrategyMeta = {
    key: 'script_hook',
    stage: 'script',
    name: '钩子驱动脚本',
    tech: 'ScriptService.generateScript()',
    impl: 'llm',
    scenarios: ['hotspot', 'realtime'],
    enabledByDefault: true,
    desc: '生成强钩子开场的短视频脚本',
  };
  constructor(private readonly script: ScriptService) {}
  async run(ctx: VideoChainContext): Promise<VideoStageResult> {
    const ids: number[] = [];
    for (const topicId of ctx.topicIds ?? []) {
      const { script } = await this.script.generateScript({ topicId });
      ids.push(script.id);
    }
    return { strategy: this.meta.key, scriptIds: ids };
  }
}

@Injectable()
export class ScriptStoryStrategy implements VideoStrategy {
  meta: StrategyMeta = {
    key: 'script_story',
    stage: 'script',
    name: '故事带货脚本',
    tech: 'ScriptService.generateScript(templateId=story_sell)',
    impl: 'llm',
    scenarios: ['ecommerce', 'brand'],
    enabledByDefault: true,
    desc: '生成故事化带货脚本',
  };
  constructor(private readonly script: ScriptService) {}
  async run(ctx: VideoChainContext): Promise<VideoStageResult> {
    const ids: number[] = [];
    for (const topicId of ctx.topicIds ?? []) {
      const { script } = await this.script.generateScript({ topicId, templateId: 'story_sell' });
      ids.push(script.id);
    }
    return { strategy: this.meta.key, scriptIds: ids };
  }
}

@Injectable()
export class ScriptKnowledgeStrategy implements VideoStrategy {
  meta: StrategyMeta = {
    key: 'script_knowledge',
    stage: 'script',
    name: '知识讲解脚本',
    tech: 'ScriptService.generateScript(templateId=knowledge)',
    impl: 'llm',
    scenarios: ['knowledge'],
    enabledByDefault: true,
    desc: '生成知识讲解型脚本（中长视频适用）',
  };
  constructor(private readonly script: ScriptService) {}
  async run(ctx: VideoChainContext): Promise<VideoStageResult> {
    const ids: number[] = [];
    for (const topicId of ctx.topicIds ?? []) {
      const { script } = await this.script.generateScript({ topicId, templateId: 'knowledge' });
      ids.push(script.id);
    }
    return { strategy: this.meta.key, scriptIds: ids };
  }
}

@Injectable()
export class ScriptSuspenseStrategy implements VideoStrategy {
  meta: StrategyMeta = {
    key: 'script_suspense',
    stage: 'script',
    name: '悬念开场脚本',
    tech: 'ScriptService.generateScript(templateId=suspense)',
    impl: 'llm',
    scenarios: ['hotspot', 'realtime'],
    enabledByDefault: true,
    desc: '生成悬念开场、留人型脚本',
  };
  constructor(private readonly script: ScriptService) {}
  async run(ctx: VideoChainContext): Promise<VideoStageResult> {
    const ids: number[] = [];
    for (const topicId of ctx.topicIds ?? []) {
      const { script } = await this.script.generateScript({ topicId, templateId: 'suspense' });
      ids.push(script.id);
    }
    return { strategy: this.meta.key, scriptIds: ids };
  }
}

@Injectable()
export class ScriptComplianceStrategy implements VideoStrategy {
  meta: StrategyMeta = {
    key: 'script_compliance',
    stage: 'script',
    name: '合规安全脚本',
    tech: 'ScriptService.generateScript(templateId=compliance_safe)',
    impl: 'llm',
    scenarios: ['compliance', 'brand'],
    enabledByDefault: true,
    desc: '生成自带合规校验的稳健型脚本',
  };
  constructor(private readonly script: ScriptService) {}
  async run(ctx: VideoChainContext): Promise<VideoStageResult> {
    const ids: number[] = [];
    for (const topicId of ctx.topicIds ?? []) {
      const { script } = await this.script.generateScript({
        topicId,
        templateId: 'compliance_safe',
      });
      ids.push(script.id);
    }
    return { strategy: this.meta.key, scriptIds: ids };
  }
}

export const SCRIPT_STRATEGIES: Type<VideoStrategy>[] = [
  ScriptHookStrategy,
  ScriptStoryStrategy,
  ScriptKnowledgeStrategy,
  ScriptSuspenseStrategy,
  ScriptComplianceStrategy,
];
