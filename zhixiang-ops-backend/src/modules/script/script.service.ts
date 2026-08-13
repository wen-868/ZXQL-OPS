import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppError } from '../../shared/app-error';
import { TenantContext } from '../../tenant/tenant-context';
import { buildPage, pageOffset } from '../../shared/pagination';
import { SkillGateway } from '../../skill/skill.gateway';
import { EMOTION_TYPES } from '../analyze/analyze.types';
import { TopicEntity } from '../topic/topic.entity';
import { ScriptEntity } from './script.entity';
import {
  ComplianceRisk,
  hasHighRisk,
  SCRIPT_PROMPT_VERSION,
  SCRIPT_TEMPLATES,
  ScriptStatus,
  canScriptTransition,
  SCRIPT_STATUSES,
} from './script.types';
import { ComplianceService } from '../compliance/compliance.service';
import { GenerateScriptDto } from './dto/generate-script.dto';
import { UpdateScriptDto } from './dto/update-script.dto';
import { ScriptQueryDto } from './dto/script-query.dto';
import { ComplianceCheckDto } from './dto/compliance-check.dto';
import { VersionScriptDto } from './dto/version-script.dto';

/**
 * 脚本工坊服务（规划 §4-F）。
 * 消费 E 选题（topicId + attributionId 透传），由能力网关生成脚本草稿；
 * 双轨（脚本/口播）、版本历史、违禁词预检（内嵌，联动 P 阶段词库治理）。
 */
@Injectable()
export class ScriptService {
  constructor(
    @InjectRepository(ScriptEntity)
    private readonly scriptRepo: Repository<ScriptEntity>,
    @InjectRepository(TopicEntity)
    private readonly topicRepo: Repository<TopicEntity>,
    private readonly skillGateway: SkillGateway,
    private readonly complianceService: ComplianceService,
  ) {}

  /** 由 E 选题生成脚本草稿（消费 topic，attributionId 透传禁止重生成） */
  async generateScript(dto: GenerateScriptDto): Promise<{ script: ScriptEntity; traceId: string }> {
    const tenantId = TenantContext.requireTenantId();
    const traceId = TenantContext.getTraceId() ?? '';

    const topic = await this.topicRepo.findOne({ where: { id: dto.topicId, tenantId } });
    if (!topic) throw new AppError('TOPIC_NOT_FOUND');

    // 早期校验：钩子情绪非法时不发起无意义的模型调用（避免浪费算力与误记用量）
    if (!(EMOTION_TYPES as readonly string[]).includes(topic.emotion)) {
      throw new AppError('EMOTION_INVALID');
    }

    const template = dto.templateId
      ? SCRIPT_TEMPLATES.find((t) => t.id === dto.templateId)
      : undefined;

    const prompt = this.buildPrompt(topic, template?.structure);
    const result = await this.skillGateway.invoke({
      skill: 'text-generate',
      prompt,
      tenantId,
    });
    const content = result.content;

    const hook = this.extractHook(content);
    const hookEmotion = topic.emotion;

    const complianceRisk = await this.scanCompliance(content);

    const script = this.scriptRepo.create({
      tenantId,
      topicId: topic.id,
      attributionId: topic.attributionId, // 透传 E，禁止重生成
      title: topic.title,
      content,
      hook,
      hookEmotion,
      spokenTrack: this.buildSpokenTrack(content),
      subtitleTrack: [],
      templateId: template ? template.id : null,
      version: 1,
      parentVersionId: null,
      status: ScriptStatus.Draft,
      complianceRisk,
      promptVersion: SCRIPT_PROMPT_VERSION,
      modelUsed: result.modelUsed,
    });
    const saved = await this.scriptRepo.save(script);
    return { script: saved, traceId };
  }

  async listScripts(query: ScriptQueryDto): Promise<{
    list: ScriptEntity[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const tenantId = TenantContext.requireTenantId();
    const { skip, take } = pageOffset(query.page, query.pageSize);

    const qb = this.scriptRepo
      .createQueryBuilder('s')
      .where('s.tenant_id = :tenantId', { tenantId });
    if (query.topicId) {
      qb.andWhere('s.topic_id = :topicId', { topicId: query.topicId });
    }
    if (query.status) {
      qb.andWhere('s.status = :status', { status: query.status });
    }
    qb.orderBy('s.created_at', 'DESC').skip(skip).take(take);

    const [list, total] = await qb.getManyAndCount();
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, query.pageSize ?? 20));
    return buildPage(list, total, page, pageSize);
  }

  async getScript(id: number): Promise<ScriptEntity> {
    const tenantId = TenantContext.requireTenantId();
    const script = await this.scriptRepo.findOne({ where: { id, tenantId } });
    if (!script) throw new AppError('SCRIPT_NOT_FOUND');
    return script;
  }

  /** 双轨编辑 + 状态机流转；发布前拦截高危违禁词 */
  async updateScript(id: number, dto: UpdateScriptDto): Promise<ScriptEntity> {
    const tenantId = TenantContext.requireTenantId();
    const script = await this.scriptRepo.findOne({ where: { id, tenantId } });
    if (!script) throw new AppError('SCRIPT_NOT_FOUND');

    if (
      dto.hookEmotion !== undefined &&
      !(EMOTION_TYPES as readonly string[]).includes(dto.hookEmotion)
    ) {
      throw new AppError('EMOTION_INVALID');
    }

    if (dto.status !== undefined) {
      if (!SCRIPT_STATUSES.includes(dto.status as ScriptStatus)) {
        throw new AppError('SCRIPT_INVALID_TRANSITION');
      }
      const from = script.status;
      const to = dto.status as ScriptStatus;
      if (!canScriptTransition(from, to)) {
        throw new AppError('SCRIPT_INVALID_TRANSITION');
      }
      // 发布前合规门禁：高危命中禁止 status=published
      if (to === ScriptStatus.Published && hasHighRisk(script.complianceRisk)) {
        throw new AppError('COMPLIANCE_BLOCKED');
      }
    }

    if (dto.title !== undefined) script.title = dto.title;
    if (dto.content !== undefined) {
      script.content = dto.content;
      script.hook = dto.hook ?? this.extractHook(dto.content);
    } else if (dto.hook !== undefined) {
      script.hook = dto.hook;
    }
    if (dto.hookEmotion !== undefined) script.hookEmotion = dto.hookEmotion;
    if (dto.spokenTrack !== undefined) script.spokenTrack = dto.spokenTrack;
    if (dto.subtitleTrack !== undefined) script.subtitleTrack = dto.subtitleTrack;
    if (dto.templateId !== undefined) script.templateId = dto.templateId;
    if (dto.status !== undefined) script.status = dto.status as ScriptStatus;

    const saved = await this.scriptRepo.save(script);
    return saved;
  }

  /** 违禁词预检（可选传入 content，否则对当前 content 检查并回写） */
  async checkCompliance(
    id: number,
    dto: ComplianceCheckDto,
  ): Promise<{ complianceRisk: ComplianceRisk; traceId: string }> {
    const tenantId = TenantContext.requireTenantId();
    const traceId = TenantContext.getTraceId() ?? '';
    const script = await this.scriptRepo.findOne({ where: { id, tenantId } });
    if (!script) throw new AppError('SCRIPT_NOT_FOUND');

    const content = dto.content ?? script.content;
    const risk = await this.scanCompliance(content);
    script.complianceRisk = risk;
    await this.scriptRepo.save(script);
    return { complianceRisk: risk, traceId };
  }

  /** 版本操作：save 存新版本 / rollback 回滚到历史版本 */
  async versionScript(
    id: number,
    dto: VersionScriptDto,
  ): Promise<{ script: ScriptEntity; traceId: string }> {
    const tenantId = TenantContext.requireTenantId();
    const traceId = TenantContext.getTraceId() ?? '';
    const current = await this.scriptRepo.findOne({ where: { id, tenantId } });
    if (!current) throw new AppError('SCRIPT_NOT_FOUND');

    if (dto.action === 'save') {
      const content = dto.content ?? current.content;
      const newScript = this.scriptRepo.create({
        tenantId,
        topicId: current.topicId,
        attributionId: current.attributionId,
        title: dto.title ?? current.title,
        content,
        hook: this.extractHook(content),
        hookEmotion: current.hookEmotion,
        spokenTrack: dto.spokenTrack ?? current.spokenTrack,
        subtitleTrack: dto.subtitleTrack ?? current.subtitleTrack,
        templateId: current.templateId,
        version: current.version + 1,
        parentVersionId: current.id,
        status: ScriptStatus.Draft,
        complianceRisk: await this.scanCompliance(content),
        promptVersion: current.promptVersion,
        modelUsed: current.modelUsed,
      });
      const saved = await this.scriptRepo.save(newScript);
      return { script: saved, traceId };
    }

    // rollback
    if (!dto.sourceVersionId) throw new AppError('SCRIPT_VERSION_REQUIRED');
    const source = await this.scriptRepo.findOne({
      where: { id: dto.sourceVersionId, tenantId, topicId: current.topicId },
    });
    if (!source) throw new AppError('SCRIPT_VERSION_NOT_FOUND');
    current.content = source.content;
    current.hook = source.hook;
    current.hookEmotion = source.hookEmotion;
    current.spokenTrack = source.spokenTrack;
    current.subtitleTrack = source.subtitleTrack;
    current.parentVersionId = source.id;
    const saved = await this.scriptRepo.save(current);
    return { script: saved, traceId };
  }

  /** 模板库（GET /templates） */
  listTemplates(): { templates: typeof SCRIPT_TEMPLATES } {
    return { templates: SCRIPT_TEMPLATES };
  }

  // ---- 私有辅助 ----

  private buildPrompt(topic: TopicEntity, templateStructure?: string): string {
    const tags = (topic.formulaTags ?? []).join('、') || '（无）';
    const structure = templateStructure ? `\n模板结构：${templateStructure}` : '';
    return [
      '你是短视频脚本编剧。基于以下选题产出一条 60 秒口播短视频脚本。',
      `选题标题：${topic.title}`,
      `人性驱动：${topic.humanDriver}`,
      `目标情绪：${topic.emotion}`,
      `公式标签：${tags}`,
      structure,
      '要求：',
      '1. 输出含「前3秒钩子」与「正文口播」两部分的纯文本；',
      '2. 钩子要能在 3 秒内抓住对应情绪；',
      '3. 避免极限词与广告法违禁表述；',
      '4. 结尾给出明确的行动召唤（关注/下单/评论）。',
    ].join('\n');
  }

  private extractHook(content: string): string {
    const firstLine = (content.split('\n').find((l) => l.trim().length > 0) ?? '').trim();
    return firstLine.length > 0 ? firstLine : content.slice(0, 60);
  }

  private buildSpokenTrack(
    content: string,
  ): Array<{ tsStart: number; tsEnd: number; text: string }> {
    return [{ tsStart: 0, tsEnd: 30, text: content }];
  }

  /** 违禁词预检：委托 P 合规预检服务（阶段补完，替代阶段1 内嵌 BANNED_WORDS） */
  private async scanCompliance(content: string): Promise<ComplianceRisk> {
    const res = await this.complianceService.checkText(content, 'script');
    return { hits: res.hits, level: res.level, checkedAt: new Date().toISOString() };
  }
}
