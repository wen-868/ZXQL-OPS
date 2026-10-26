import { Injectable, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(ScriptService.name);
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
    const structure = template?.structure;
    const prompt = this.buildPrompt(topic, structure);
    const result = await this.invokeWithFallback(topic, tenantId, prompt, structure);
    const content = result.content;

    const script = this.scriptRepo.create({
      tenantId,
      topicId: topic.id,
      attributionId: topic.attributionId, // 透传 E，禁止重生成
      title: topic.title,
      content,
      hook: this.extractHook(content),
      hookEmotion: topic.emotion,
      spokenTrack: this.buildSpokenTrack(content),
      subtitleTrack: [],
      templateId: template ? template.id : null,
      version: 1,
      parentVersionId: null,
      status: ScriptStatus.Draft,
      complianceRisk: await this.scanCompliance(content),
      promptVersion: SCRIPT_PROMPT_VERSION,
      modelUsed: result.modelUsed,
    });
    const saved = await this.scriptRepo.save(script);
    return { script: saved, traceId };
  }

  /**
   * 调能力网关生成脚本；不可用时降级为本地模板脚本，保证「上架」阶段在无外部模型
   * 环境下仍可自动产出草稿；有模型时始终走模型。
   */
  private async invokeWithFallback(
    topic: TopicEntity,
    tenantId: string,
    prompt: string,
    structure?: string,
  ): Promise<{ content: string; modelUsed?: string }> {
    try {
      return await this.skillGateway.invoke({ skill: 'text-generate', prompt, tenantId });
    } catch (err) {
      this.logger.warn(
        `[script#${topic.id}] 能力网关不可用，降级模板脚本：${(err as Error).message}`,
      );
      return { content: this.buildFallbackScript(topic, structure), modelUsed: 'rule-fallback' };
    }
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

    this.assertScriptUpdate(script, dto);
    this.applyScriptFields(script, dto);
    return this.scriptRepo.save(script);
  }

  /** 编辑前校验：情绪合法性 → 状态机流转 → 发布合规门禁 */
  private assertScriptUpdate(script: ScriptEntity, dto: UpdateScriptDto): void {
    if (
      dto.hookEmotion !== undefined &&
      !(EMOTION_TYPES as readonly string[]).includes(dto.hookEmotion)
    ) {
      throw new AppError('EMOTION_INVALID');
    }
    if (dto.status === undefined) return;

    const to = dto.status as ScriptStatus;
    if (!SCRIPT_STATUSES.includes(to) || !canScriptTransition(script.status, to)) {
      throw new AppError('SCRIPT_INVALID_TRANSITION');
    }
    // 发布前合规门禁：高危命中禁止 status=published
    if (to === ScriptStatus.Published && hasHighRisk(script.complianceRisk)) {
      throw new AppError('COMPLIANCE_BLOCKED');
    }
  }

  /** 可直赋字段清单（dtoKey → entityKey），数据驱动避免 if 堆叠 */
  private static readonly SCALAR_FIELDS: Array<[keyof UpdateScriptDto, keyof ScriptEntity]> = [
    ['title', 'title'],
    ['hookEmotion', 'hookEmotion'],
    ['spokenTrack', 'spokenTrack'],
    ['subtitleTrack', 'subtitleTrack'],
    ['templateId', 'templateId'],
    ['status', 'status'],
  ];

  /** 字段写入：标量按清单赋值；content/hook 联动特殊处理 */
  private applyScriptFields(script: ScriptEntity, dto: UpdateScriptDto): void {
    for (const [dtoKey, entityKey] of ScriptService.SCALAR_FIELDS) {
      const value = dto[dtoKey];
      if (value !== undefined) {
        (script as unknown as Record<string, unknown>)[entityKey] = value;
      }
    }
    if (dto.content !== undefined) {
      script.content = dto.content;
      script.hook = dto.hook ?? this.extractHook(dto.content);
    } else if (dto.hook !== undefined) {
      script.hook = dto.hook;
    }
  }

  /**
   * 自动免审通道（供自动化投流阶段调用）：draft/reviewing 脚本在合规非高危时自动置 approved。
   * 生成时已跑过 P 合规预检（scanCompliance），此处仅复核高风险门禁，不重复扫描。
   */
  async autoApprove(id: number): Promise<ScriptEntity> {
    const tenantId = TenantContext.requireTenantId();
    const script = await this.scriptRepo.findOne({ where: { id, tenantId } });
    if (!script) throw new AppError('SCRIPT_NOT_FOUND');
    if (script.status === ScriptStatus.Approved || script.status === ScriptStatus.Published) {
      return script;
    }
    if (hasHighRisk(script.complianceRisk)) {
      throw new AppError('COMPLIANCE_BLOCKED');
    }
    script.status = ScriptStatus.Approved;
    return this.scriptRepo.save(script);
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
      const newScript = await this.buildNextVersion(current, tenantId, dto);
      const saved = await this.scriptRepo.save(newScript);
      return { script: saved, traceId };
    }
    // rollback
    return { script: await this.rollbackVersion(current, tenantId, dto), traceId };
  }

  /** action=save：基于当前脚本构造 version+1 的新草稿 */
  private async buildNextVersion(
    current: ScriptEntity,
    tenantId: string,
    dto: VersionScriptDto,
  ): Promise<ScriptEntity> {
    const content = dto.content ?? current.content;
    return this.scriptRepo.create({
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
  }

  /** action=rollback：校验来源版本后覆盖当前脚本内容并回写 parentVersionId */
  private async rollbackVersion(
    current: ScriptEntity,
    tenantId: string,
    dto: VersionScriptDto,
  ): Promise<ScriptEntity> {
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
    return this.scriptRepo.save(current);
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

  /** 规则兜底脚本：无 LLM 时按选题信息拼模板草稿（可交付、可过合规扫描） */
  private buildFallbackScript(topic: TopicEntity, templateStructure?: string): string {
    const tags = (topic.formulaTags ?? []).join('、') || '无';
    const structure = templateStructure ? `\n结构参考：${templateStructure}` : '';
    return [
      `【前3秒钩子】你注意到了吗？${topic.title.slice(0, 24)}`,
      `【正文口播】今天聊一个特别扎心的话题：${topic.title}。`,
      `很多人忽略了它的背后逻辑——它之所以引发共鸣，是因为戳中了「${topic.humanDriver}」这个人性本能，情绪上是「${topic.emotion}」。`,
      `公式标签：${tags}。${structure}`,
      `【结尾行动召唤】如果你也有同感，点赞关注，评论区聊聊你的看法。`,
    ].join('\n');
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
