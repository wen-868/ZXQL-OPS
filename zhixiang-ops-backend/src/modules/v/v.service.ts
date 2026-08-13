import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppError } from '../../shared/app-error';
import { TenantContext } from '../../tenant/tenant-context';
import { TenantBaseRepository } from '../../tenant/tenant-base.repository';
import { AuditService } from '../n/audit.service';
import { ProductEntity } from '../r/product.entity';
import { VideoEntity } from '../h/video.entity';
import { RevenueService } from '../w/w.service';
import { BrandOrderEntity, BrandOrderStatus } from './brand-order.entity';
import { TalentEntity, TalentStatus } from './talent.entity';
import { BRAND_ORDER_TRANSITIONS, TALENT_STATUSES } from './v.types';
import { CreateBrandOrderDto, CreateTalentDto, SettleBrandOrderDto, UpdateTalentDto } from './dto';

/**
 * 达人/商单管理服务（规划 §4-V / 开发顺序 V 达人/商单管理 / 阶段3 增强）。
 * 达人库(talents) + 商单(brand_orders)；商单分账落地到 W(收益与对账)。
 * 弱关联：B 账号(talent_account_id)、R 商品(product_id)、H 成片(video_id)、K 数字人(digitalHumanId)。
 * 金额用 decimal；分账经 RevenueService.settle 复用 W 的分账引擎与审计。
 * 租户隔离：业务查询显式 where 携带 tenantId，且仓库层 TenantBaseRepository 读期自动兜底注入。
 */
@Injectable()
export class TalentCommerceService {
  constructor(
    @InjectRepository(TalentEntity)
    private readonly talentRepo: TenantBaseRepository<TalentEntity>,
    @InjectRepository(BrandOrderEntity)
    private readonly orderRepo: TenantBaseRepository<BrandOrderEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    @InjectRepository(VideoEntity)
    private readonly videoRepo: Repository<VideoEntity>,
    private readonly revenueService: RevenueService,
    private readonly audit: AuditService,
  ) {}

  // ---------- 达人 ----------

  async createTalent(dto: CreateTalentDto): Promise<TalentEntity> {
    const tenantId = TenantContext.requireTenantId();
    const saved = await this.talentRepo.save(
      this.talentRepo.create({
        tenantId,
        name: dto.name,
        type: dto.type ?? 'internal',
        contact: dto.contact,
        talentAccountId: dto.talentAccountId,
        digitalHumanId: dto.digitalHumanId,
        agencyShareRate: dto.agencyShareRate ?? 0,
        talentShareRate: dto.talentShareRate ?? 0,
        status: dto.status ?? 'active',
        meta: dto.meta,
      }),
    );
    await this.audit.record({ action: 'create', module: 'talent', resource: `talent:${saved.id}` });
    return saved;
  }

  async listTalents(): Promise<TalentEntity[]> {
    const tenantId = TenantContext.requireTenantId();
    return this.talentRepo.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
  }

  async getTalent(id: number): Promise<TalentEntity> {
    const tenantId = TenantContext.requireTenantId();
    const e = await this.talentRepo.findOne({ where: { id, tenantId } });
    if (!e) throw new AppError('TALENT_NOT_FOUND');
    return e;
  }

  async updateTalent(id: number, dto: UpdateTalentDto): Promise<TalentEntity> {
    const e = await this.getTalent(id);
    if (dto.name !== undefined) e.name = dto.name;
    if (dto.type !== undefined) e.type = dto.type;
    if (dto.contact !== undefined) e.contact = dto.contact;
    if (dto.talentAccountId !== undefined) e.talentAccountId = dto.talentAccountId;
    if (dto.digitalHumanId !== undefined) e.digitalHumanId = dto.digitalHumanId;
    if (dto.agencyShareRate !== undefined) e.agencyShareRate = dto.agencyShareRate;
    if (dto.talentShareRate !== undefined) e.talentShareRate = dto.talentShareRate;
    if (dto.status !== undefined) e.status = dto.status;
    if (dto.meta !== undefined) e.meta = dto.meta;
    const saved = await this.talentRepo.save(e);
    await this.audit.record({ action: 'update', module: 'talent', resource: `talent:${saved.id}` });
    return saved;
  }

  async setTalentStatus(id: number, status: TalentStatus): Promise<TalentEntity> {
    if (!TALENT_STATUSES.includes(status)) throw new AppError('INVALID_PARAM');
    const e = await this.getTalent(id);
    e.status = status;
    const saved = await this.talentRepo.save(e);
    await this.audit.record({ action: 'status', module: 'talent', resource: `talent:${saved.id}` });
    return saved;
  }

  async deleteTalent(id: number): Promise<{ id: number }> {
    const e = await this.getTalent(id);
    await this.talentRepo.softDelete({ id: e.id, tenantId: e.tenantId });
    await this.audit.record({ action: 'delete', module: 'talent', resource: `talent:${e.id}` });
    return { id };
  }

  // ---------- 商单 ----------

  private async validateBrandOrderLink(dto: CreateBrandOrderDto): Promise<void> {
    if (dto.productId) {
      const p = await this.productRepo.findOne({
        where: { id: dto.productId, tenantId: TenantContext.requireTenantId() },
      });
      if (!p) throw new AppError('PRODUCT_NOT_FOUND');
    }
    if (dto.videoId) {
      const v = await this.videoRepo.findOne({
        where: { id: dto.videoId, tenantId: TenantContext.requireTenantId() },
      });
      if (!v) throw new AppError('VIDEO_NOT_FOUND');
    }
  }

  async createBrandOrder(dto: CreateBrandOrderDto): Promise<BrandOrderEntity> {
    const tenantId = TenantContext.requireTenantId();
    const talent = await this.getTalent(dto.talentId);
    await this.validateBrandOrderLink(dto);
    const saved = await this.orderRepo.save(
      this.orderRepo.create({
        tenantId,
        advertiser: dto.advertiser,
        talentId: dto.talentId,
        productId: dto.productId,
        accountId: dto.accountId,
        videoId: dto.videoId,
        amount: dto.amount,
        agencyShareRate: dto.agencyShareRate ?? talent.agencyShareRate ?? 0,
        talentShareRate: dto.talentShareRate ?? talent.talentShareRate ?? 0,
        status: dto.status ?? 'pending',
        contractNo: dto.contractNo,
        meta: dto.meta,
      }),
    );
    await this.audit.record({
      action: 'create',
      module: 'brand_order',
      resource: `brand_order:${saved.id}`,
    });
    return saved;
  }

  async listBrandOrders(): Promise<BrandOrderEntity[]> {
    const tenantId = TenantContext.requireTenantId();
    return this.orderRepo.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
  }

  async getBrandOrder(id: number): Promise<BrandOrderEntity> {
    const tenantId = TenantContext.requireTenantId();
    const e = await this.orderRepo.findOne({ where: { id, tenantId } });
    if (!e) throw new AppError('BRAND_ORDER_NOT_FOUND');
    return e;
  }

  async setBrandOrderStatus(id: number, status: BrandOrderStatus): Promise<BrandOrderEntity> {
    const e = await this.getBrandOrder(id);
    const allowed = BRAND_ORDER_TRANSITIONS[e.status] ?? [];
    if (!allowed.includes(status)) throw new AppError('INVALID_STATUS_TRANSITION');
    e.status = status;
    const saved = await this.orderRepo.save(e);
    await this.audit.record({
      action: 'status',
      module: 'brand_order',
      resource: `brand_order:${saved.id}`,
    });
    return saved;
  }

  /** 商单分账：按达人分成比例算出机构/达人两方，落地到 W 分账引擎；回填 settlementId */
  async settleBrandOrder(id: number, dto: SettleBrandOrderDto): Promise<BrandOrderEntity> {
    const order = await this.getBrandOrder(id);
    if (order.settlementId) throw new AppError('BRAND_ORDER_ALREADY_SETTLED');
    if (order.status !== 'completed' && !dto.toStatus) {
      throw new AppError('INVALID_STATUS_TRANSITION');
    }
    const total = Number(order.amount);
    if (!(total > 0)) throw new AppError('INVALID_PARAM');

    const talentRate = Number(dto.talentShareRate);
    const talentShare = Math.round(((total * talentRate) / 100) * 100) / 100;
    const agencyShare = Math.round((total - talentShare) * 100) / 100;
    const talent = await this.getTalent(order.talentId);

    const settlement = await this.revenueService.settle({
      type: 'org_talent_advertiser',
      amount: total,
      parties: [
        { role: 'talent', amount: talentShare, name: talent.name },
        { role: 'org', amount: agencyShare, name: order.advertiser ?? '机构' },
      ],
    });

    order.talentShareRate = talentRate;
    order.agencyShareRate = Math.round((100 - talentRate) * 100) / 100;
    order.settlementId = settlement.id;
    order.status = 'settled';
    const saved = await this.orderRepo.save(order);
    await this.audit.record({
      action: 'settle',
      module: 'brand_order',
      resource: `brand_order:${saved.id}`,
    });
    return saved;
  }

  async deleteBrandOrder(id: number): Promise<{ id: number }> {
    const e = await this.getBrandOrder(id);
    // 已分账的商单禁止删除（关联交易记录）
    if (e.settlementId) throw new AppError('BRAND_ORDER_ALREADY_SETTLED');
    await this.orderRepo.softDelete({ id: e.id, tenantId: e.tenantId });
    await this.audit.record({
      action: 'delete',
      module: 'brand_order',
      resource: `brand_order:${e.id}`,
    });
    return { id };
  }

  // ---------- 概览（看板用） ----------

  async summary(): Promise<{
    talentCount: number;
    activeTalentCount: number;
    orderCount: number;
    settledCount: number;
    totalAmount: number;
    settledAmount: number;
  }> {
    const tenantId = TenantContext.requireTenantId();
    const [talents, orders] = await Promise.all([
      this.talentRepo.find({ where: { tenantId } }),
      this.orderRepo.find({ where: { tenantId } }),
    ]);
    const activeTalents = talents.filter((t) => t.status === 'active');
    const settled = orders.filter((o) => o.status === 'settled');
    const totalAmount = orders.reduce((s, o) => s + Number(o.amount), 0);
    const settledAmount = settled.reduce((s, o) => s + Number(o.amount), 0);
    return {
      talentCount: talents.length,
      activeTalentCount: activeTalents.length,
      orderCount: orders.length,
      settledCount: settled.length,
      totalAmount: Math.round(totalAmount * 100) / 100,
      settledAmount: Math.round(settledAmount * 100) / 100,
    };
  }
}
