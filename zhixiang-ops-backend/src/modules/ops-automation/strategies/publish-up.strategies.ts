import { Injectable } from '@nestjs/common';
import { ScriptService } from '../../script/script.service';
import { OpsChainContext, OpsStrategy, PublishUpResult } from '../ops-automation.types';

/**
 * 上架(内容生产)阶段 5 种实现方案：统一入口为 ScriptService.generateScript（经能力网关 LLM），
 * 通过不同模板/创作路径（双轨、钩子流、带货、知识、合规）覆盖多场景。
 * - hook_driven：钩子驱动口播（rule+llm，通用短视频）
 * - story_sell：剧情带货（llm，电商）
 * - knowledge_explain：知识科普（llm，知识）
 * - suspense_open：悬念开场（hybrid，品牌/种草）
 * - compliance_safe：合规安全版（rule，合规校验前置）
 */

@Injectable()
export class PublishUpHookDrivenStrategy implements OpsStrategy {
  meta = {
    key: 'publishup_hook_driven',
    stage: 'publish-up' as const,
    name: '钩子驱动上架',
    tech: 'LLM(text-generate) + Script Templates',
    impl: 'llm' as const,
    scenarios: ['hotspot', 'ecommerce'],
    enabledByDefault: true,
    desc: '强钩子开场口播脚本，适合通用短视频与带货。',
  };
  constructor(private readonly scriptService: ScriptService) {}
  async run(ctx: OpsChainContext): Promise<PublishUpResult> {
    const ids: number[] = [];
    for (const topicId of ctx.topicIds ?? []) {
      const { script } = await this.scriptService.generateScript({ topicId });
      ids.push(script.id);
    }
    return { scriptIds: ids, strategy: this.meta.key };
  }
}

@Injectable()
export class PublishUpStorySellStrategy implements OpsStrategy {
  meta = {
    key: 'publishup_story_sell',
    stage: 'publish-up' as const,
    name: '剧情带货上架',
    tech: 'LLM(story) + Script Templates',
    impl: 'llm' as const,
    scenarios: ['ecommerce', 'local-life'],
    enabledByDefault: true,
    desc: '剧情化种草脚本，提升转化，适合电商带货。',
  };
  constructor(private readonly scriptService: ScriptService) {}
  async run(ctx: OpsChainContext): Promise<PublishUpResult> {
    const ids: number[] = [];
    for (const topicId of ctx.topicIds ?? []) {
      const { script } = await this.scriptService.generateScript({
        topicId,
        templateId: 'story_sell',
      });
      ids.push(script.id);
    }
    return { scriptIds: ids, strategy: this.meta.key };
  }
}

@Injectable()
export class PublishUpKnowledgeExplainStrategy implements OpsStrategy {
  meta = {
    key: 'publishup_knowledge_explain',
    stage: 'publish-up' as const,
    name: '知识科普上架',
    tech: 'LLM(explain) + Script Templates',
    impl: 'llm' as const,
    scenarios: ['knowledge'],
    enabledByDefault: true,
    desc: '结构化知识讲解脚本，适合科普/教育。',
  };
  constructor(private readonly scriptService: ScriptService) {}
  async run(ctx: OpsChainContext): Promise<PublishUpResult> {
    const ids: number[] = [];
    for (const topicId of ctx.topicIds ?? []) {
      const { script } = await this.scriptService.generateScript({
        topicId,
        templateId: 'knowledge',
      });
      ids.push(script.id);
    }
    return { scriptIds: ids, strategy: this.meta.key };
  }
}

@Injectable()
export class PublishUpSuspenseOpenStrategy implements OpsStrategy {
  meta = {
    key: 'publishup_suspense_open',
    stage: 'publish-up' as const,
    name: '悬念开场上架',
    tech: 'Hybrid(suspense hook + LLM) + Script Templates',
    impl: 'hybrid' as const,
    scenarios: ['brand', 'hotspot'],
    enabledByDefault: true,
    desc: '悬念式开场提升完播，适合品牌种草。',
  };
  constructor(private readonly scriptService: ScriptService) {}
  async run(ctx: OpsChainContext): Promise<PublishUpResult> {
    const ids: number[] = [];
    for (const topicId of ctx.topicIds ?? []) {
      const { script } = await this.scriptService.generateScript({
        topicId,
        templateId: 'suspense',
      });
      ids.push(script.id);
    }
    return { scriptIds: ids, strategy: this.meta.key };
  }
}

@Injectable()
export class PublishUpComplianceSafeStrategy implements OpsStrategy {
  meta = {
    key: 'publishup_compliance_safe',
    stage: 'publish-up' as const,
    name: '合规安全上架',
    tech: 'Rule(compliance pre-check) + LLM',
    impl: 'rule' as const,
    scenarios: ['compliance', 'ecommerce'],
    enabledByDefault: true,
    desc: '生成前预检违禁词、生成后强制合规扫描，合规优先。',
  };
  constructor(private readonly scriptService: ScriptService) {}
  async run(ctx: OpsChainContext): Promise<PublishUpResult> {
    const ids: number[] = [];
    for (const topicId of ctx.topicIds ?? []) {
      const { script } = await this.scriptService.generateScript({
        topicId,
        templateId: 'compliance_safe',
      });
      ids.push(script.id);
    }
    return { scriptIds: ids, strategy: this.meta.key };
  }
}

export const PUBLISH_UP_STRATEGIES = [
  PublishUpHookDrivenStrategy,
  PublishUpStorySellStrategy,
  PublishUpKnowledgeExplainStrategy,
  PublishUpSuspenseOpenStrategy,
  PublishUpComplianceSafeStrategy,
];
