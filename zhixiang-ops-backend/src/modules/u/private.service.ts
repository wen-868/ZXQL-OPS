import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantContext } from '../../tenant/tenant-context';
import { AppError } from '../../shared/app-error';
import { AuditService } from '../../modules/n/audit.service';
import { FansProfileEntity, PrivateGroupEntity } from './index';
import { FansProfileView, PrivateGroupView } from './u.types';
import { UpsertFansDto } from './dto/upsert-fans.dto';
import { TagFansDto } from './dto/tag-fans.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { DistributeDto } from './dto/distribute.dto';
import { RepurchaseDto } from './dto/repurchase.dto';

@Injectable()
export class PrivateService {
  constructor(
    @InjectRepository(FansProfileEntity)
    private readonly fansRepo: Repository<FansProfileEntity>,
    @InjectRepository(PrivateGroupEntity)
    private readonly groupRepo: Repository<PrivateGroupEntity>,
    private readonly audit: AuditService,
  ) {}

  private toFansView(e: FansProfileEntity): FansProfileView {
    return {
      id: e.id,
      platform: e.platform,
      publicId: e.publicId,
      level: e.level,
      interactAgg: e.interactAgg ?? null,
      tags: e.tags ?? null,
      source: e.source,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    };
  }

  private toGroupView(e: PrivateGroupEntity): PrivateGroupView {
    return {
      id: e.id,
      name: e.name,
      members: e.members ?? [],
      type: e.type,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    };
  }

  /** 粉丝画像 upsert（仅聚合/公开字段，合规 §11②：禁个体隐私） */
  async upsertFans(dto: UpsertFansDto): Promise<FansProfileView> {
    const tenantId = TenantContext.requireTenantId();
    let e = await this.fansRepo.findOne({
      where: { tenantId, platform: dto.platform, publicId: dto.publicId },
    });
    if (!e) {
      e = this.fansRepo.create({
        tenantId,
        platform: dto.platform,
        publicId: dto.publicId,
        level: dto.level ?? 'normal',
        interactAgg: dto.interactAgg ?? null,
        tags: dto.tags ?? null,
        source: dto.source ?? 'aggregate',
      });
    } else {
      if (dto.level) e.level = dto.level;
      if (dto.interactAgg) e.interactAgg = dto.interactAgg;
      if (dto.tags) e.tags = dto.tags;
      if (dto.source) e.source = dto.source;
    }
    const saved = await this.fansRepo.save(e);
    await this.audit.record({
      action: 'upsert_fans_profile',
      module: 'private',
      resource: `fans:${saved.id}`,
    });
    return this.toFansView(saved);
  }

  /** 粉丝画像（聚合分布列表） */
  async listFans(platform?: string): Promise<FansProfileView[]> {
    const tenantId = TenantContext.requireTenantId();
    const where: { tenantId: string; platform?: string } = { tenantId };
    if (platform) where.platform = platform;
    const list = await this.fansRepo.find({ where, order: { createdAt: 'DESC' } });
    return list.map((e) => this.toFansView(e));
  }

  /** 分层打标 */
  async tagFans(dto: TagFansDto): Promise<FansProfileView> {
    const tenantId = TenantContext.requireTenantId();
    const e = await this.fansRepo.findOne({ where: { id: dto.id, tenantId } });
    if (!e) throw new AppError('FANS_PROFILE_NOT_FOUND');
    e.tags = dto.tags;
    const saved = await this.fansRepo.save(e);
    await this.audit.record({
      action: 'tag_fans_profile',
      module: 'private',
      resource: `fans:${saved.id}`,
    });
    return this.toFansView(saved);
  }

  /** 建私域群（members 仅公开ID） */
  async createGroup(dto: CreateGroupDto): Promise<PrivateGroupView> {
    const tenantId = TenantContext.requireTenantId();
    const e = this.groupRepo.create({
      tenantId,
      name: dto.name,
      type: dto.type ?? 'wecom',
      members: dto.members ?? [],
    });
    const saved = await this.groupRepo.save(e);
    await this.audit.record({
      action: 'create_private_group',
      module: 'private',
      resource: `group:${saved.id}`,
    });
    return this.toGroupView(saved);
  }

  /** 私域触达（企微/微信，合规：仅向群内已授权公开ID触达） */
  async pushGroup(id: number): Promise<{ pushed: number }> {
    const tenantId = TenantContext.requireTenantId();
    const e = await this.groupRepo.findOne({ where: { id, tenantId } });
    if (!e) throw new AppError('PRIVATE_GROUP_NOT_FOUND');
    const pushed = e.members?.length ?? 0;
    await this.audit.record({
      action: 'push_private_group',
      module: 'private',
      resource: `group:${id}`,
    });
    return { pushed };
  }

  /** 推客分销（分级佣金 → 供 W 复购佣金对账，仅含公开ID与佣金比例） */
  async distribute(
    dto: DistributeDto,
  ): Promise<{ planName: string; tiers: number; commission: number }> {
    TenantContext.requireTenantId();
    const tiers = dto.publicIds.length;
    await this.audit.record({
      action: 'fans_distribute',
      module: 'private',
      resource: `distribute:${dto.planName}`,
    });
    return { planName: dto.planName, tiers, commission: dto.tierCommission };
  }

  /** 复购 CRM（→ W 复购佣金对账，仅公开ID与金额） */
  async repurchase(dto: RepurchaseDto): Promise<{ publicId: string; amount: number }> {
    TenantContext.requireTenantId();
    await this.audit.record({
      action: 'fans_repurchase',
      module: 'private',
      resource: `fans:${dto.publicId}`,
    });
    return { publicId: dto.publicId, amount: dto.amount ?? 0 };
  }
}
