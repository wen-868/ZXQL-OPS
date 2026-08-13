import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantContext } from '../../tenant/tenant-context';
import { generateAttributionId } from '../../core/attribution-id';
import { SkillGateway } from '../../skill/skill.gateway';
import { AppError } from '../../shared/app-error';
import { AuditService } from '../../modules/n/audit.service';
import {
  LiveRoomEntity,
  DigitalHumanEntity,
  LiveDanmuEntity,
  LiveAiReplyEntity,
  LiveStatEntity,
} from './index';
import { LiveRoomView, DigitalHumanView, LiveAiReplyView, LiveStatView } from './k.types';
import { CreateRoomDto } from './dto/create-room.dto';
import { CreateDigitalHumanDto } from './dto/create-digital-human.dto';
import { DanmuAiReplyDto } from './dto/danmu-ai-reply.dto';
import { ReportStatDto } from './dto/report-stat.dto';
import { AccountEntity } from '../../modules/account/account.entity';
import { AccountGroupEntity } from '../../modules/account/account-group.entity';
import { AccountHealthEventEntity } from '../../modules/account/account-health-event.entity';
import { scoreBaseByStatus } from '../../modules/account/account-score';
import { ProductEntity } from '../../modules/r/product.entity';

/** 直播间与 B 矩阵的账号联动信息（只读聚合，不落库） */
interface AccountLink {
  accountGroupId: number | null;
  accountGroupName: string | null;
  accountHealthScore: number | null;
}

const EMPTY_LINK: AccountLink = {
  accountGroupId: null,
  accountGroupName: null,
  accountHealthScore: null,
};

@Injectable()
export class LiveService {
  private readonly logger = new Logger(LiveService.name);

  constructor(
    @InjectRepository(LiveRoomEntity)
    private readonly roomRepo: Repository<LiveRoomEntity>,
    @InjectRepository(DigitalHumanEntity)
    private readonly digitalHumanRepo: Repository<DigitalHumanEntity>,
    @InjectRepository(LiveDanmuEntity)
    private readonly danmuRepo: Repository<LiveDanmuEntity>,
    @InjectRepository(LiveAiReplyEntity)
    private readonly aiReplyRepo: Repository<LiveAiReplyEntity>,
    @InjectRepository(LiveStatEntity)
    private readonly statRepo: Repository<LiveStatEntity>,
    @InjectRepository(AccountEntity)
    private readonly accountRepo: Repository<AccountEntity>,
    @InjectRepository(AccountGroupEntity)
    private readonly groupRepo: Repository<AccountGroupEntity>,
    @InjectRepository(AccountHealthEventEntity)
    private readonly eventRepo: Repository<AccountHealthEventEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    private readonly skill: SkillGateway,
    private readonly audit: AuditService,
  ) {}

  /** 组装与 B 矩阵的联动信息（分组名 + 健康分兜底），仅用于只读展示 */
  private async resolveAccountLink(account: AccountEntity): Promise<AccountLink> {
    let accountGroupId: number | null = null;
    let accountGroupName: string | null = null;
    if (account.groupId != null) {
      const group = await this.groupRepo.findOne({
        where: { id: account.groupId, tenantId: account.tenantId },
      });
      if (group) {
        accountGroupId = group.id;
        accountGroupName = group.name;
      }
    }
    return {
      accountGroupId,
      accountGroupName,
      accountHealthScore: account.healthScore ?? scoreBaseByStatus(account.status),
    };
  }

  /** 直播结束 → 账号活跃回写（lastActiveAt + live_ended 健康事件，不改变账号状态） */
  private async touchAccountActivity(accountId: number): Promise<void> {
    const tenantId = TenantContext.requireTenantId();
    const account = await this.accountRepo.findOne({ where: { id: accountId, tenantId } });
    if (!account) return;
    account.lastActiveAt = new Date();
    await this.accountRepo.save(account);
    await this.eventRepo.save(
      this.eventRepo.create({
        tenantId,
        accountId: Number(account.id),
        eventType: 'live_ended',
        prevStatus: account.status,
        nextStatus: account.status,
        detail: '直播结束，账号活跃回写',
      }),
    );
  }

  private toRoomView(e: LiveRoomEntity, link: AccountLink = EMPTY_LINK): LiveRoomView {
    return {
      id: e.id,
      type: e.type,
      platform: e.platform,
      accountId: e.accountId,
      rtmpUrl: e.rtmpUrl ?? null,
      status: e.status,
      title: e.title ?? null,
      productIds: e.productIds ?? [],
      attributionId: e.attributionId,
      startedAt: e.startedAt ?? null,
      endedAt: e.endedAt ?? null,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
      accountGroupId: link.accountGroupId,
      accountGroupName: link.accountGroupName,
      accountHealthScore: link.accountHealthScore,
    };
  }

  /** 建直播间：生成 live 类 attribution_id，绑定 B 账号，校验挂载的 R 商品 */
  async createRoom(dto: CreateRoomDto): Promise<LiveRoomView> {
    const tenantId = TenantContext.requireTenantId();

    const account = await this.accountRepo.findOne({
      where: { id: dto.accountId, tenantId },
    });
    if (!account) {
      throw new AppError('LIVE_ACCOUNT_NOT_FOUND');
    }

    if (dto.productIds && dto.productIds.length > 0) {
      const owned = await this.productRepo.count({
        where: dto.productIds.map((id) => ({ id, tenantId })),
      });
      if (owned !== dto.productIds.length) {
        throw new AppError('LIVE_PRODUCT_NOT_FOUND');
      }
    }

    const attributionId = generateAttributionId(tenantId, 'live', `${dto.accountId}:${Date.now()}`);

    const room = this.roomRepo.create({
      tenantId,
      type: dto.type,
      platform: dto.platform,
      accountId: dto.accountId,
      title: dto.title ?? null,
      productIds: dto.productIds ?? [],
      attributionId,
      status: 'created',
    });
    const saved = await this.roomRepo.save(room);
    await this.audit.record({
      action: 'create_live_room',
      module: 'live',
      resource: `live_room:${saved.id}`,
    });
    return this.toRoomView(saved, await this.resolveAccountLink(account));
  }

  /** 开播：created→live */
  async startRoom(id: number): Promise<LiveRoomView> {
    const tenantId = TenantContext.requireTenantId();
    const room = await this.roomRepo.findOne({ where: { id, tenantId } });
    if (!room) throw new AppError('LIVE_ROOM_NOT_FOUND');
    if (room.status !== 'created') {
      throw new AppError('LIVE_ROOM_NOT_CREATED');
    }
    room.status = 'live';
    room.startedAt = new Date();
    const saved = await this.roomRepo.save(room);
    await this.audit.record({
      action: 'start_live_room',
      module: 'live',
      resource: `live_room:${saved.id}`,
    });
    return this.toRoomView(saved);
  }

  /** 结束：live→ended；回写账号活跃（lastActiveAt + live_ended 健康事件，失败不影响主链路） */
  async endRoom(id: number): Promise<LiveRoomView> {
    const tenantId = TenantContext.requireTenantId();
    const room = await this.roomRepo.findOne({ where: { id, tenantId } });
    if (!room) throw new AppError('LIVE_ROOM_NOT_FOUND');
    if (room.status !== 'live') {
      throw new AppError('LIVE_ROOM_NOT_LIVE');
    }
    room.status = 'ended';
    room.endedAt = new Date();
    const saved = await this.roomRepo.save(room);
    await this.audit.record({
      action: 'end_live_room',
      module: 'live',
      resource: `live_room:${saved.id}`,
    });
    if (room.accountId) {
      await this.touchAccountActivity(room.accountId).catch((e) => {
        this.logger.warn(`直播结束活跃回写失败（不影响主链路）: ${(e as Error).message}`);
      });
    }
    return this.toRoomView(saved);
  }

  /** 推流：中控推流（MVP 仅记录 rtmp，真实推流由 OBS/数字人渲染完成） */
  async pushStream(id: number, rtmpUrl: string): Promise<LiveRoomView> {
    const tenantId = TenantContext.requireTenantId();
    const room = await this.roomRepo.findOne({ where: { id, tenantId } });
    if (!room) throw new AppError('LIVE_ROOM_NOT_FOUND');
    room.rtmpUrl = rtmpUrl;
    const saved = await this.roomRepo.save(room);
    await this.audit.record({
      action: 'push_live_stream',
      module: 'live',
      resource: `live_room:${saved.id}`,
    });
    return this.toRoomView(saved);
  }

  async getRoom(id: number): Promise<LiveRoomView> {
    const tenantId = TenantContext.requireTenantId();
    const room = await this.roomRepo.findOne({ where: { id, tenantId } });
    if (!room) throw new AppError('LIVE_ROOM_NOT_FOUND');
    let link: AccountLink = EMPTY_LINK;
    if (room.accountId) {
      const account = await this.accountRepo.findOne({
        where: { id: room.accountId, tenantId },
      });
      if (account) link = await this.resolveAccountLink(account);
    }
    return this.toRoomView(room, link);
  }

  /** 实时监控：最新一条 live_stats */
  async getStats(id: number): Promise<LiveStatView | null> {
    const tenantId = TenantContext.requireTenantId();
    const room = await this.roomRepo.findOne({ where: { id, tenantId } });
    if (!room) throw new AppError('LIVE_ROOM_NOT_FOUND');
    const stat = await this.statRepo.findOne({
      where: { tenantId, roomId: id },
      order: { ts: 'DESC' },
    });
    if (!stat) return null;
    return {
      id: stat.id,
      roomId: stat.roomId,
      onlineCount: stat.onlineCount,
      gmv: Number(stat.gmv),
      attributionId: stat.attributionId,
      ts: stat.ts,
    };
  }

  /** 上报统计：透传直播间 attribution_id */
  async reportStat(dto: ReportStatDto): Promise<LiveStatView> {
    const tenantId = TenantContext.requireTenantId();
    const room = await this.roomRepo.findOne({ where: { id: dto.roomId, tenantId } });
    if (!room) throw new AppError('LIVE_ROOM_NOT_FOUND');
    const stat = this.statRepo.create({
      tenantId,
      roomId: dto.roomId,
      onlineCount: dto.onlineCount ?? 0,
      gmv: dto.gmv ?? 0,
      attributionId: room.attributionId,
      ts: dto.ts ? new Date(dto.ts) : new Date(),
    });
    const saved = await this.statRepo.save(stat);
    return {
      id: saved.id,
      roomId: saved.roomId,
      onlineCount: saved.onlineCount,
      gmv: Number(saved.gmv),
      attributionId: saved.attributionId,
      ts: saved.ts,
    };
  }

  /** 数字人管理 */
  async createDigitalHuman(dto: CreateDigitalHumanDto): Promise<DigitalHumanView> {
    const tenantId = TenantContext.requireTenantId();
    const e = this.digitalHumanRepo.create({
      tenantId,
      name: dto.name,
      avatar: dto.avatar ?? null,
      voice: dto.voice ?? null,
      status: dto.status ?? 'active',
    });
    const saved = await this.digitalHumanRepo.save(e);
    return {
      id: saved.id,
      name: saved.name,
      avatar: saved.avatar ?? null,
      voice: saved.voice ?? null,
      status: saved.status,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    };
  }

  /** 弹幕 AI 应答闭环：auto 直接经 SkillGateway 生成回复；pending 落待确认记录 */
  async danmuAiReply(dto: DanmuAiReplyDto): Promise<LiveAiReplyView> {
    const tenantId = TenantContext.requireTenantId();
    const room = await this.roomRepo.findOne({ where: { id: dto.roomId, tenantId } });
    if (!room) throw new AppError('LIVE_ROOM_NOT_FOUND');

    const status = dto.status ?? 'auto';
    let answer: string | null = null;
    if (status === 'auto') {
      answer = await this.skill.generateText(
        `作为直播带货助手，用一句话友好回答观众问题：「${dto.question}」`,
        tenantId,
      );
    }

    const reply = this.aiReplyRepo.create({
      tenantId,
      roomId: dto.roomId,
      question: dto.question,
      answer,
      status,
    });
    const saved = await this.aiReplyRepo.save(reply);

    if (status === 'auto' && answer) {
      const danmu = this.danmuRepo.create({
        tenantId,
        roomId: dto.roomId,
        content: dto.question,
        isAiReply: true,
        aiReply: answer,
        ts: new Date(),
      });
      await this.danmuRepo.save(danmu);
    }

    await this.audit.record({
      action: 'live_danmu_ai_reply',
      module: 'live',
      resource: `live_room:${dto.roomId}`,
    });

    return {
      id: saved.id,
      roomId: saved.roomId,
      question: saved.question,
      answer: saved.answer ?? null,
      status: saved.status,
    };
  }
}
