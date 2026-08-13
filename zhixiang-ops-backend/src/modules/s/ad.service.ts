import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantContext } from '../../tenant/tenant-context';
import { generateAttributionId } from '../../core/attribution-id';
import { SkillGateway } from '../../skill/skill.gateway';
import { AppError } from '../../shared/app-error';
import { AuditService } from '../../modules/n/audit.service';
import { AdAccountEntity, AdCampaignEntity, AdMetricEntity } from './index';
import { AdAccountView, AdCampaignView, AdMetricView, AdReviewView } from './s.types';
import { CreateAdAccountDto } from './dto/create-ad-account.dto';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { ReportMetricDto } from './dto/report-metric.dto';
import { SmartBidDto } from './dto/smart-bid.dto';

@Injectable()
export class AdService {
  constructor(
    @InjectRepository(AdAccountEntity)
    private readonly accountRepo: Repository<AdAccountEntity>,
    @InjectRepository(AdCampaignEntity)
    private readonly campaignRepo: Repository<AdCampaignEntity>,
    @InjectRepository(AdMetricEntity)
    private readonly metricRepo: Repository<AdMetricEntity>,
    private readonly skill: SkillGateway,
    private readonly audit: AuditService,
  ) {}

  private toAccountView(e: AdAccountEntity): AdAccountView {
    return {
      id: e.id,
      platform: e.platform,
      type: e.type,
      status: e.status,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    };
  }

  private toCampaignView(e: AdCampaignEntity): AdCampaignView {
    return {
      id: e.id,
      accountId: e.accountId,
      name: e.name,
      planType: e.planType,
      audience: e.audience ?? null,
      budget: Number(e.budget),
      spend: Number(e.spend),
      roi: Number(e.roi),
      attributionId: e.attributionId,
      status: e.status,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    };
  }

  /** 投放账户绑定 */
  async createAccount(dto: CreateAdAccountDto): Promise<AdAccountView> {
    const tenantId = TenantContext.requireTenantId();
    const e = this.accountRepo.create({
      tenantId,
      platform: dto.platform,
      type: dto.type,
      authEnc: dto.authEnc ?? null,
      status: dto.status ?? 'active',
    });
    const saved = await this.accountRepo.save(e);
    await this.audit.record({
      action: 'bind_ad_account',
      module: 'ad',
      resource: `ad_account:${saved.id}`,
    });
    return this.toAccountView(saved);
  }

  /** 建计划：生成 ad 类 attribution_id */
  async createCampaign(dto: CreateCampaignDto): Promise<AdCampaignView> {
    const tenantId = TenantContext.requireTenantId();
    const account = await this.accountRepo.findOne({
      where: { id: dto.accountId, tenantId },
    });
    if (!account) throw new AppError('AD_ACCOUNT_NOT_FOUND');

    const attributionId = generateAttributionId(
      tenantId,
      'ad',
      `${dto.accountId}:${dto.name}:${Date.now()}`,
    );
    const e = this.campaignRepo.create({
      tenantId,
      accountId: dto.accountId,
      name: dto.name,
      planType: dto.planType,
      audience: dto.audience ?? null,
      budget: dto.budget ?? 0,
      spend: 0,
      roi: 0,
      attributionId,
      status: 'draft',
    });
    const saved = await this.campaignRepo.save(e);
    await this.audit.record({
      action: 'create_ad_campaign',
      module: 'ad',
      resource: `ad_campaign:${saved.id}`,
    });
    return this.toCampaignView(saved);
  }

  /** 实时监控：聚合最新指标 */
  async getMetrics(id: number): Promise<AdMetricView | null> {
    const tenantId = TenantContext.requireTenantId();
    const campaign = await this.campaignRepo.findOne({ where: { id, tenantId } });
    if (!campaign) throw new AppError('AD_CAMPAIGN_NOT_FOUND');
    const metric = await this.metricRepo.findOne({
      where: { tenantId, campaignId: id },
      order: { date: 'DESC' },
    });
    if (!metric) return null;
    return {
      id: metric.id,
      campaignId: metric.campaignId,
      date: metric.date.toISOString().slice(0, 10),
      impressions: metric.impressions,
      clicks: metric.clicks,
      conversions: metric.conversions,
      cost: Number(metric.cost),
      roi: Number(metric.roi),
    };
  }

  /** 智能出价：调 SkillGateway 给建议（MVP 不实际改平台出价，仅产出建议） */
  async smartBid(dto: SmartBidDto): Promise<{ suggestion: string }> {
    const tenantId = TenantContext.requireTenantId();
    const campaign = await this.campaignRepo.findOne({ where: { id: dto.campaignId, tenantId } });
    if (!campaign) throw new AppError('AD_CAMPAIGN_NOT_FOUND');
    const suggestion = await this.skill.generateText(
      `投放计划「${campaign.name}」当前 ROI=${campaign.roi}，预算=${campaign.budget}。` +
        `目标 ROI=${dto.targetRoi ?? '未指定'}，请给出智能出价调整建议（一句话）。`,
      tenantId,
    );
    await this.audit.record({
      action: 'ad_smart_bid',
      module: 'ad',
      resource: `ad_campaign:${dto.campaignId}`,
    });
    return { suggestion };
  }

  /** 复盘（五维四率/撬自然流）：聚合指标 + 透传 attribution_id */
  async review(id: number): Promise<AdReviewView> {
    const tenantId = TenantContext.requireTenantId();
    const campaign = await this.campaignRepo.findOne({ where: { id, tenantId } });
    if (!campaign) throw new AppError('AD_CAMPAIGN_NOT_FOUND');
    const metrics = await this.metricRepo.find({ where: { tenantId, campaignId: id } });
    const totalCost = metrics.reduce((s, m) => s + Number(m.cost), 0);
    const totalConversions = metrics.reduce((s, m) => s + m.conversions, 0);
    const totalSpend = Number(campaign.spend);
    const roi = totalCost > 0 ? Number((totalSpend / totalCost).toFixed(2)) : 0;
    return {
      campaignId: id,
      attributionId: campaign.attributionId,
      totalSpend,
      totalCost: Number(totalCost.toFixed(2)),
      totalConversions,
      roi,
      metricsCount: metrics.length,
    };
  }

  /** 指标上报：更新 campaign spend/roi（供实时监控与对账） */
  async reportMetric(dto: ReportMetricDto): Promise<AdMetricView> {
    const tenantId = TenantContext.requireTenantId();
    const campaign = await this.campaignRepo.findOne({ where: { id: dto.campaignId, tenantId } });
    if (!campaign) throw new AppError('AD_CAMPAIGN_NOT_FOUND');
    const metric = this.metricRepo.create({
      tenantId,
      campaignId: dto.campaignId,
      date: dto.date ? new Date(dto.date) : new Date(),
      impressions: dto.impressions ?? 0,
      clicks: dto.clicks ?? 0,
      conversions: dto.conversions ?? 0,
      cost: dto.cost ?? 0,
      roi: dto.roi ?? 0,
    });
    const saved = await this.metricRepo.save(metric);
    // 回写计划累计消耗与 ROI
    campaign.spend = Number(campaign.spend) + (dto.cost ?? 0);
    if (campaign.spend > 0 && dto.cost && dto.cost > 0) {
      campaign.roi = Number(((dto.roi ?? 0) || campaign.roi).toFixed(2));
    }
    await this.campaignRepo.save(campaign);
    return {
      id: saved.id,
      campaignId: saved.campaignId,
      date: saved.date.toISOString().slice(0, 10),
      impressions: saved.impressions,
      clicks: saved.clicks,
      conversions: saved.conversions,
      cost: Number(saved.cost),
      roi: Number(saved.roi),
    };
  }
}
