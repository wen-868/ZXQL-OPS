import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantContext } from '../../tenant/tenant-context';
import { AuditService } from '../../modules/n/audit.service';
import { AppError } from '../../shared/app-error';
import { OrderService } from '../../modules/y/y.service';
import { ProductService } from '../../modules/r/product.service';
import { SkillGateway } from '../../skill/skill.gateway';
import {
  CustomerSessionEntity,
  CustomerMessageEntity,
  SupportTicketEntity,
  KnowledgeEntity,
  CsSettingsEntity,
} from './index';
import type { CsChannel } from './session.entity';
import type { TicketPriority } from './ticket.entity';
import type { KnowledgeCategory } from './knowledge.entity';
import {
  CustomerSessionView,
  CustomerMessageView,
  SupportTicketView,
  KnowledgeView,
  CsSettingsView,
  AiReplyView,
} from './aa.types';
import {
  CreateSessionDto,
  UserMessageDto,
  TransferDto,
  CreateKnowledgeDto,
  UpdateKnowledgeDto,
  UpsertSettingsDto,
  ListSessionDto,
  ListTicketDto,
} from './dto';

const DEFAULT_CHANNELS: CsChannel[] = [
  'live_comment',
  'private_dm',
  'short_video_comment',
  'order_message',
];
/** 高风险/投诉意图关键词（命中直接低置信度转人工） */
const HIGH_RISK = ['投诉', '举报', '起诉', '曝光', '维权', '假货', '欺诈', '欺骗'];

/**
 * 智能客服中心服务（规划 AA）。
 * - 多渠道接入：直播评论 / 私域 DM / 短视频评论 / 订单留言（经 I/K/U 事件驱动创建会话）。
 * - AI 自动回复：意图识别 + 知识库命中 + 订单/物流/商品结构化查询兜底 + 能力网关 text-generate 生成（源透明）。
 * - 转人工：低置信度 / 高风险 / 显式请求；创建工单并标记会话 transferred。
 * - 合规边界②：仅以匿名 buyer_ref 关联会话（非 PII，明文存储可复用），不采集姓名/电话/地址；真实 PII 加密在 Y 的 buyer_info。
 * - 跨租户：所有查询/写入 where 携带 tenantId。
 */
@Injectable()
export class CustomerService {
  constructor(
    @InjectRepository(CustomerSessionEntity) private sessionRepo: Repository<CustomerSessionEntity>,
    @InjectRepository(CustomerMessageEntity) private messageRepo: Repository<CustomerMessageEntity>,
    @InjectRepository(SupportTicketEntity) private ticketRepo: Repository<SupportTicketEntity>,
    @InjectRepository(KnowledgeEntity) private knowledgeRepo: Repository<KnowledgeEntity>,
    @InjectRepository(CsSettingsEntity) private settingsRepo: Repository<CsSettingsEntity>,
    private order: OrderService,
    private product: ProductService,
    private skill: SkillGateway,
    private audit: AuditService,
  ) {}

  // ---------- 视图映射 ----------
  private toSessionView(e: CustomerSessionEntity): CustomerSessionView {
    return {
      id: e.id,
      channel: e.channel,
      buyerRef: e.buyerRef, // 匿名引用，非 PII，明文展示
      relatedOrderId: e.relatedOrderId ?? null,
      relatedProductId: e.relatedProductId ?? null,
      status: e.status,
      lastMessage: e.lastMessage ?? null,
      messageCount: e.messageCount,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    };
  }

  private toMessageView(e: CustomerMessageEntity): CustomerMessageView {
    return {
      id: e.id,
      sessionId: e.sessionId,
      role: e.role,
      content: e.content,
      intent: e.intent ?? null,
      confidence: e.confidence ?? null,
      createdAt: e.createdAt,
    };
  }

  private toTicketView(e: SupportTicketEntity): SupportTicketView {
    return {
      id: e.id,
      sessionId: e.sessionId ?? null,
      buyerRef: e.buyerRef ?? null,
      issue: e.issue,
      status: e.status,
      priority: e.priority,
      assignedTo: e.assignedTo ?? null,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    };
  }

  private toKnowledgeView(e: KnowledgeEntity): KnowledgeView {
    return {
      id: e.id,
      category: e.category,
      question: e.question,
      answer: e.answer,
      source: e.source,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    };
  }

  private toSettingsView(e: CsSettingsEntity): CsSettingsView {
    let channels: string[] = DEFAULT_CHANNELS;
    try {
      const parsed: unknown = JSON.parse(e.enabledChannels);
      if (Array.isArray(parsed)) channels = parsed as string[];
    } catch {
      channels = DEFAULT_CHANNELS;
    }
    return {
      id: e.id,
      enabledChannels: channels,
      transferThreshold: e.transferThreshold,
      autoReplyEnabled: e.autoReplyEnabled,
      greeting: e.greeting ?? null,
      workingHours: e.workingHours ?? null,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    };
  }

  // ---------- 设置（每租户单条，upsert） ----------
  private async getSettingsEntity(tenantId: string): Promise<CsSettingsEntity | null> {
    return this.settingsRepo.findOne({ where: { tenantId } });
  }

  async getSettings(): Promise<CsSettingsView> {
    const tenantId = TenantContext.requireTenantId();
    const e = await this.getSettingsEntity(tenantId);
    if (!e) {
      return {
        id: 0,
        enabledChannels: DEFAULT_CHANNELS,
        transferThreshold: 0.5,
        autoReplyEnabled: true,
        greeting: null,
        workingHours: null,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      };
    }
    return this.toSettingsView(e);
  }

  async upsertSettings(dto: UpsertSettingsDto): Promise<CsSettingsView> {
    const tenantId = TenantContext.requireTenantId();
    let e = await this.getSettingsEntity(tenantId);
    if (!e) {
      e = this.settingsRepo.create({
        tenantId,
        enabledChannels: JSON.stringify(DEFAULT_CHANNELS),
        transferThreshold: 0.5,
        autoReplyEnabled: true,
      });
    }
    if (dto.enabledChannels !== undefined) e.enabledChannels = JSON.stringify(dto.enabledChannels);
    if (dto.transferThreshold !== undefined) e.transferThreshold = dto.transferThreshold;
    if (dto.autoReplyEnabled !== undefined) e.autoReplyEnabled = dto.autoReplyEnabled;
    if (dto.greeting !== undefined) e.greeting = dto.greeting;
    if (dto.workingHours !== undefined) e.workingHours = dto.workingHours;
    const saved = await this.settingsRepo.save(e);
    await this.audit.record({
      action: 'cs_settings_upsert',
      module: 'customer_service',
      resource: `settings:${tenantId}`,
    });
    return this.toSettingsView(saved);
  }

  // ---------- 会话（多渠道接入 + 复用） ----------
  async createSession(dto: CreateSessionDto): Promise<CustomerSessionView> {
    const tenantId = TenantContext.requireTenantId();
    // 同租户同渠道同买家复用进行中的会话（避免重复会话）
    const existing = await this.sessionRepo.findOne({
      where: { tenantId, channel: dto.channel, buyerRef: dto.buyerRef, status: 'open' },
    });
    if (existing) return this.toSessionView(existing);

    const e = this.sessionRepo.create({
      tenantId,
      channel: dto.channel,
      buyerRef: dto.buyerRef, // 匿名引用，明文存储（非 PII）
      relatedOrderId: dto.relatedOrderId ?? null,
      relatedProductId: dto.relatedProductId ?? null,
      status: 'open',
      messageCount: 0,
    });
    const saved = await this.sessionRepo.save(e);
    await this.audit.record({
      action: 'cs_session_create',
      module: 'customer_service',
      resource: `session:${saved.id}`,
    });
    return this.toSessionView(saved);
  }

  async listSessions(filter: ListSessionDto = {}): Promise<CustomerSessionView[]> {
    const tenantId = TenantContext.requireTenantId();
    const where: Record<string, unknown> = { tenantId };
    if (filter.channel) where.channel = filter.channel;
    if (filter.status) where.status = filter.status;
    const rows = await this.sessionRepo.find({ where, order: { createdAt: 'DESC' } });
    return rows.map((e) => this.toSessionView(e));
  }

  async getSession(
    id: number,
  ): Promise<{ session: CustomerSessionView; messages: CustomerMessageView[] }> {
    const tenantId = TenantContext.requireTenantId();
    const session = await this.sessionRepo.findOne({ where: { id, tenantId } });
    if (!session) throw new AppError('CS_SESSION_NOT_FOUND');
    const msgs = await this.messageRepo.find({
      where: { tenantId, sessionId: id },
      order: { createdAt: 'ASC' },
    });
    return {
      session: this.toSessionView(session),
      messages: msgs.map((m) => this.toMessageView(m)),
    };
  }

  // ---------- 消息 + AI 自动回复 ----------
  async sendMessage(
    sessionId: number,
    dto: UserMessageDto,
  ): Promise<{
    session: CustomerSessionView;
    userMessage: CustomerMessageView;
    aiReply: AiReplyView | null;
  }> {
    const tenantId = TenantContext.requireTenantId();
    const session = await this.sessionRepo.findOne({ where: { id: sessionId, tenantId } });
    if (!session) throw new AppError('CS_SESSION_NOT_FOUND');

    const um = await this.messageRepo.save(
      this.messageRepo.create({
        tenantId,
        sessionId,
        role: 'user',
        content: dto.content,
        intent: null,
        confidence: null,
      }),
    );
    session.messageCount += 1;
    session.lastMessage = dto.content.slice(0, 512);
    await this.sessionRepo.save(session);

    let aiReply: AiReplyView | null = null;
    const settings = await this.getSettingsEntity(tenantId);
    const autoReply = settings ? settings.autoReplyEnabled : true;
    if (autoReply && session.status !== 'transferred') {
      aiReply = await this.generateReply(session, dto.content);
    }
    await this.audit.record({
      action: 'cs_message',
      module: 'customer_service',
      resource: `session:${sessionId}`,
    });
    return { session: this.toSessionView(session), userMessage: this.toMessageView(um), aiReply };
  }

  /** 意图识别（最小内嵌关键词分类） */
  private classify(content: string): { intent: string; confidence: number } {
    if (/人工|客服|转人工|真人|人工客服/.test(content))
      return { intent: 'human_handoff', confidence: 0.05 };
    if (HIGH_RISK.some((w) => content.includes(w))) return { intent: 'complaint', confidence: 0.2 };
    if (/订单|我的单|发货|退款|付款|购买/.test(content))
      return { intent: 'order', confidence: 0.8 };
    if (/物流|快递|到哪|什么时候到|签收|运单/.test(content))
      return { intent: 'logistics', confidence: 0.8 };
    if (/商品|怎么卖|多少钱|价格|库存/.test(content)) return { intent: 'product', confidence: 0.8 };
    return { intent: 'unknown', confidence: 0.3 };
  }

  /** 知识库命中（子串匹配，MVP） */
  private async matchKnowledge(
    tenantId: string,
    _intent: string,
    content: string,
  ): Promise<KnowledgeEntity | null> {
    const rows = await this.knowledgeRepo.find({ where: { tenantId } });
    for (const kb of rows) {
      if (content.includes(kb.question) || kb.question.includes(content)) return kb;
    }
    return null;
  }

  /** 结构化查询兜底（订单/物流/商品，读 Y/R） */
  private async tryStructuredReply(
    tenantId: string,
    intent: string,
    session: CustomerSessionEntity,
  ): Promise<string | null> {
    if ((intent === 'order' || intent === 'logistics') && session.relatedOrderId) {
      const o = await this.order.getOrder(session.relatedOrderId);
      if (intent === 'logistics') {
        const tracks = await this.order.getLogisticsTrack(session.relatedOrderId);
        const last = tracks[tracks.length - 1];
        return `订单 #${o.orderId} 物流状态：${last ? `${last.node}（${last.ts.toISOString()}）` : o.logisticsStatus}。`;
      }
      return `订单 #${o.orderId} 当前状态：${o.status}，金额 ¥${o.amount}。`;
    }
    if (intent === 'product' && session.relatedProductId) {
      const products = await this.product.list();
      const p = products.find((x) => x.id === session.relatedProductId);
      if (p) return `商品「${p.title}」价格 ¥${p.price ?? '—'}，库存 ${p.stock}。`;
    }
    return null;
  }

  /** 生成 AI 回复（知识库 → 结构化查询 → 能力网关；低置信度转人工） */
  private async generateReply(
    session: CustomerSessionEntity,
    content: string,
  ): Promise<AiReplyView> {
    const tenantId = session.tenantId;
    const settings = await this.getSettingsEntity(tenantId);
    const threshold = settings ? settings.transferThreshold : 0.5;

    const intent = this.classify(content);
    const kb = await this.matchKnowledge(tenantId, intent.intent, content);
    let replyText: string;
    let confidence: number;

    if (kb) {
      replyText = kb.answer;
      confidence = 0.95;
    } else {
      const structured = await this.tryStructuredReply(tenantId, intent.intent, session);
      if (structured) {
        replyText = structured;
        confidence = 0.9;
      } else {
        try {
          replyText = await this.skill.generateText(
            `你是电商智能客服。用户咨询：${content}。请简洁友好回复，不超过100字。`,
            tenantId,
          );
          confidence = Math.max(intent.confidence, 0.6);
        } catch {
          replyText = '抱歉，暂时无法自动回复，已为您转接人工客服。';
          confidence = 0.1;
        }
      }
    }

    let transferred = false;
    let ticketId: number | null = null;
    if (intent.intent === 'human_handoff' || confidence < threshold) {
      const ticket = await this.createTicket(session, content, 'medium');
      ticketId = ticket.id;
      transferred = true;
      session.status = 'transferred';
    }

    await this.messageRepo.save(
      this.messageRepo.create({
        tenantId,
        sessionId: session.id,
        role: 'ai',
        content: replyText,
        intent: intent.intent,
        confidence,
      }),
    );
    session.lastMessage = replyText.slice(0, 512);
    session.messageCount += 1;
    await this.sessionRepo.save(session);

    return { reply: replyText, intent: intent.intent, confidence, transferred, ticketId };
  }

  // ---------- 转人工工单 ----------
  private async createTicket(
    session: CustomerSessionEntity,
    issue: string,
    priority: TicketPriority,
  ): Promise<SupportTicketEntity> {
    const e = this.ticketRepo.create({
      tenantId: session.tenantId,
      sessionId: session.id,
      buyerRef: session.buyerRef,
      issue,
      status: 'open',
      priority,
    });
    return this.ticketRepo.save(e);
  }

  async transfer(sessionId: number, dto: TransferDto): Promise<SupportTicketView> {
    const tenantId = TenantContext.requireTenantId();
    const session = await this.sessionRepo.findOne({ where: { id: sessionId, tenantId } });
    if (!session) throw new AppError('CS_SESSION_NOT_FOUND');
    const ticket = await this.createTicket(
      session,
      dto.issue ?? '用户请求转人工',
      dto.priority ?? 'medium',
    );
    session.status = 'transferred';
    await this.sessionRepo.save(session);
    await this.audit.record({
      action: 'cs_transfer',
      module: 'customer_service',
      resource: `session:${sessionId}`,
    });
    return this.toTicketView(ticket);
  }

  async listTickets(filter: ListTicketDto = {}): Promise<SupportTicketView[]> {
    const tenantId = TenantContext.requireTenantId();
    const where: Record<string, unknown> = { tenantId };
    if (filter.status) where.status = filter.status;
    if (filter.priority) where.priority = filter.priority;
    const rows = await this.ticketRepo.find({ where, order: { createdAt: 'DESC' } });
    return rows.map((e) => this.toTicketView(e));
  }

  async getTicket(id: number): Promise<SupportTicketView> {
    const tenantId = TenantContext.requireTenantId();
    const e = await this.ticketRepo.findOne({ where: { id, tenantId } });
    if (!e) throw new AppError('CS_TICKET_NOT_FOUND');
    return this.toTicketView(e);
  }

  async resolveTicket(id: number): Promise<SupportTicketView> {
    const tenantId = TenantContext.requireTenantId();
    const e = await this.ticketRepo.findOne({ where: { id, tenantId } });
    if (!e) throw new AppError('CS_TICKET_NOT_FOUND');
    e.status = 'resolved';
    const saved = await this.ticketRepo.save(e);
    await this.audit.record({
      action: 'cs_ticket_resolve',
      module: 'customer_service',
      resource: `ticket:${id}`,
    });
    return this.toTicketView(saved);
  }

  // ---------- 知识库 ----------
  async createKnowledge(dto: CreateKnowledgeDto): Promise<KnowledgeView> {
    const tenantId = TenantContext.requireTenantId();
    const e = this.knowledgeRepo.create({
      tenantId,
      category: dto.category,
      question: dto.question,
      answer: dto.answer,
      source: 'manual',
    });
    const saved = await this.knowledgeRepo.save(e);
    await this.audit.record({
      action: 'cs_kb_create',
      module: 'customer_service',
      resource: `kb:${saved.id}`,
    });
    return this.toKnowledgeView(saved);
  }

  async listKnowledge(category?: KnowledgeCategory): Promise<KnowledgeView[]> {
    const tenantId = TenantContext.requireTenantId();
    const where: Record<string, unknown> = { tenantId };
    if (category) where.category = category;
    const rows = await this.knowledgeRepo.find({ where, order: { createdAt: 'DESC' } });
    return rows.map((e) => this.toKnowledgeView(e));
  }

  async updateKnowledge(id: number, dto: UpdateKnowledgeDto): Promise<KnowledgeView> {
    const tenantId = TenantContext.requireTenantId();
    const e = await this.knowledgeRepo.findOne({ where: { id, tenantId } });
    if (!e) throw new AppError('CS_KNOWLEDGE_NOT_FOUND');
    if (dto.category !== undefined) e.category = dto.category;
    if (dto.question !== undefined) e.question = dto.question;
    if (dto.answer !== undefined) e.answer = dto.answer;
    const saved = await this.knowledgeRepo.save(e);
    return this.toKnowledgeView(saved);
  }

  async deleteKnowledge(id: number): Promise<{ id: number }> {
    const tenantId = TenantContext.requireTenantId();
    const e = await this.knowledgeRepo.findOne({ where: { id, tenantId } });
    if (!e) throw new AppError('CS_KNOWLEDGE_NOT_FOUND');
    await this.knowledgeRepo.softRemove(e);
    return { id };
  }

  /** 同步 R 商品 / Y 订单 生成知识条目（source=sync_r / sync_y，按 question 去重） */
  async syncKnowledgeFromRY(): Promise<{ added: number }> {
    const tenantId = TenantContext.requireTenantId();
    const products = await this.product.list();
    const orders = await this.order.listOrders();
    let added = 0;

    for (const p of products) {
      const question = `商品「${p.title}」的价格和库存`;
      const exists = await this.knowledgeRepo.findOne({
        where: { tenantId, category: 'product', question },
      });
      if (!exists) {
        await this.knowledgeRepo.save(
          this.knowledgeRepo.create({
            tenantId,
            category: 'product',
            question,
            answer: `「${p.title}」当前价格 ¥${p.price ?? '—'}，库存 ${p.stock}。`,
            source: 'sync_r',
          }),
        );
        added++;
      }
    }
    for (const o of orders) {
      const question = `订单 ${o.orderId} 的状态`;
      const exists = await this.knowledgeRepo.findOne({
        where: { tenantId, category: 'order', question },
      });
      if (!exists) {
        await this.knowledgeRepo.save(
          this.knowledgeRepo.create({
            tenantId,
            category: 'order',
            question,
            answer: `订单 ${o.orderId} 状态：${o.status}，物流：${o.logisticsStatus}。`,
            source: 'sync_y',
          }),
        );
        added++;
      }
    }
    await this.audit.record({
      action: 'cs_kb_sync',
      module: 'customer_service',
      resource: `sync:${tenantId}`,
    });
    return { added };
  }
}
