import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectLiteral, Repository } from 'typeorm';
import { AppError } from '../../shared/app-error';
import { TenantContext } from '../../tenant/tenant-context';
import { RecycleService } from '../recycle/recycle.service';
import { DashboardEntity } from './dashboard.entity';
import {
  AccountCompareItem,
  AccountCompareView,
  FunnelStage,
  FunnelView,
  HumanHookItem,
  HumanHookView,
  OverviewCards,
  OverviewView,
  TopicEfficiencyItem,
  TopicEfficiencyView,
  TrendPoint,
} from './m.types';
import { CreateDashboardDto, UpdateDashboardDto } from './dto';

// 各域实体（仅聚合查询，跨租户 tenantId 强隔离）
import { TopicEntity } from '../topic/topic.entity';
import { ScriptEntity } from '../script/script.entity';
import { PublishTaskEntity } from '../publish/publish.entity';
import { FeedbackEntity, DriverEfficiencyEntity } from '../recycle/recycle.entity';
import { AccountEntity } from '../account/account.entity';
import { RevenueRecordEntity } from '../w/revenue.entity';
import { AdCampaignEntity } from '../s/ad-campaign.entity';
import { AdMetricEntity } from '../s/ad-metric.entity';
import { OrderEntity } from '../y/order.entity';

type Metrics = {
  play?: number;
  interact?: number;
  fanInc?: number;
  commission?: number;
  completeRate?: number;
};

/**
 * 决策仪表盘与 BI 服务（规划 §4-M / 开发顺序 M 仪表盘与 BI）。
 * 作为统一 BI 聚合层：复用 J(RecycleService) 的五维四率核心指标卡与 7×6 人性效能，
 * 并跨域轻量聚合（内容生产率→分发覆盖→触达→互动→转化→收益 全链路漏斗、账号对比、
 * 选题效能榜、人性钩子分析）。所有查询 where 携带 tenantId 强隔离。
 * 合规边界②：仅聚合业务指标，不采集单条个人信息。
 */
@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly recycleService: RecycleService,
    @InjectRepository(DashboardEntity)
    private readonly dashboardRepo: Repository<DashboardEntity>,
    @InjectRepository(TopicEntity)
    private readonly topicRepo: Repository<TopicEntity>,
    @InjectRepository(ScriptEntity)
    private readonly scriptRepo: Repository<ScriptEntity>,
    @InjectRepository(PublishTaskEntity)
    private readonly publishRepo: Repository<PublishTaskEntity>,
    @InjectRepository(FeedbackEntity)
    private readonly feedbackRepo: Repository<FeedbackEntity>,
    @InjectRepository(DriverEfficiencyEntity)
    private readonly driverEffRepo: Repository<DriverEfficiencyEntity>,
    @InjectRepository(AccountEntity)
    private readonly accountRepo: Repository<AccountEntity>,
    @InjectRepository(RevenueRecordEntity)
    private readonly revenueRepo: Repository<RevenueRecordEntity>,
    @InjectRepository(AdCampaignEntity)
    private readonly adCampaignRepo: Repository<AdCampaignEntity>,
    @InjectRepository(AdMetricEntity)
    private readonly adMetricRepo: Repository<AdMetricEntity>,
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
  ) {}

  // —— 1. 核心指标卡 + 趋势（复用 J 五维四率，BI 层优雅降级） ——

  async getOverview(): Promise<OverviewView> {
    const tenantId = TenantContext.requireTenantId();
    let cards: OverviewCards;
    try {
      const o = await this.recycleService.getDashboardOverview();
      cards = {
        totalPlay: o.totalPlay,
        avgCompleteRate: o.avgCompleteRate,
        totalInteract: o.totalInteract,
        totalFanInc: o.totalFanInc,
        totalCommission: o.totalCommission,
        completeRate: o.completeRate,
        interactRate: o.interactRate,
        fanRate: o.fanRate,
        conversionRate: o.conversionRate,
        videoCount: o.videoCount,
      };
    } catch {
      // 尚未跑回收任务：BI 层返回全 0 空卡，不阻断看板
      cards = {
        totalPlay: 0,
        avgCompleteRate: 0,
        totalInteract: 0,
        totalFanInc: 0,
        totalCommission: 0,
        completeRate: 0,
        interactRate: 0,
        fanRate: 0,
        conversionRate: 0,
        videoCount: 0,
      };
    }
    const trend = await this.buildTrend(tenantId);
    return { cards, trend };
  }

  private async buildTrend(tenantId: string): Promise<TrendPoint[]> {
    const feedbacks = await this.feedbackRepo.find({ where: { tenantId } });
    const days = 7;
    const buckets = new Map<string, { play: number; interact: number }>();
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      buckets.set(key, { play: 0, interact: 0 });
    }
    for (const f of feedbacks) {
      if (!f.createdAt) continue;
      const key = f.createdAt.toISOString().slice(0, 10);
      const b = buckets.get(key);
      if (b) {
        const m = (f.metrics ?? {}) as Metrics;
        b.play += m.play ?? 0;
        b.interact += m.interact ?? 0;
      }
    }
    return Array.from(buckets.entries()).map(([date, v]) => ({
      date,
      play: v.play,
      interact: v.interact,
    }));
  }

  // —— 2. 全链路漏斗（内容生产率 → 分发覆盖 → 触达 → 互动 → 转化 → 收益） ——

  async getFunnel(): Promise<FunnelView> {
    const tenantId = TenantContext.requireTenantId();
    const [topicCount, scriptCount, publishCount, orderConvSum, feedbacks, revenueSum, spendSum] =
      await Promise.all([
        this.topicRepo.count({ where: { tenantId } }),
        this.scriptRepo.count({ where: { tenantId } }),
        this.publishRepo.count({ where: { tenantId } }),
        this.sumInt(this.publishRepo, 'orderConv', tenantId),
        this.feedbackRepo.find({ where: { tenantId } }),
        this.sumDecimal(this.revenueRepo, 'amount', tenantId),
        this.sumSpend(tenantId),
      ]);

    let reachPlay = 0;
    let interactions = 0;
    let commission = 0;
    for (const f of feedbacks) {
      const m = (f.metrics ?? {}) as Metrics;
      reachPlay += m.play ?? 0;
      interactions += m.interact ?? 0;
      commission += m.commission ?? 0;
    }
    const totalCommission = Number((commission + revenueSum).toFixed(2));
    const conversions = orderConvSum; // 经 Y 回写的下单转化（发布侧）
    const stages: FunnelStage[] = [
      { name: '内容生产率', value: topicCount + scriptCount },
      { name: '分发覆盖', value: publishCount },
      { name: '触达播放', value: reachPlay },
      { name: '互动', value: interactions },
      { name: '转化', value: conversions },
      { name: '收益', value: totalCommission },
    ];
    const roi = spendSum > 0 ? Number((totalCommission / spendSum).toFixed(2)) : 0;
    return { stages, spend: Number(spendSum.toFixed(2)), roi };
  }

  // —— 3. 账号对比 ——

  async getAccountCompare(): Promise<AccountCompareView> {
    const tenantId = TenantContext.requireTenantId();
    const accounts = await this.accountRepo.find({ where: { tenantId } });
    const [publishCounts, totalPlay] = await Promise.all([
      Promise.all(
        accounts.map((a) => this.publishRepo.count({ where: { tenantId, accountId: a.id } })),
      ),
      this.sumFeedbackPlay(tenantId),
    ]);
    let totalFans = 0;
    let totalPublish = 0;
    const items: AccountCompareItem[] = accounts.map((a, i) => {
      totalFans += a.fansCount ?? 0;
      totalPublish += publishCounts[i];
      return {
        accountId: Number(a.id),
        nickname: a.nickname,
        platform: a.platform,
        fansCount: a.fansCount ?? 0,
        publishCount: publishCounts[i],
        playShare: 0,
      };
    });
    for (const it of items) {
      it.playShare = totalPublish ? Number((it.publishCount / totalPublish).toFixed(4)) : 0;
    }
    return {
      accounts: items,
      totals: { fansCount: totalFans, publishCount: totalPublish, play: totalPlay },
    };
  }

  // —— 4. 选题效能榜 ——

  async getTopicEfficiency(): Promise<TopicEfficiencyView> {
    const tenantId = TenantContext.requireTenantId();
    const topics = await this.topicRepo.find({ where: { tenantId } });
    const deRows = await this.driverEffRepo.find({ where: { tenantId } });
    const deMap = new Map<string, DriverEfficiencyEntity>();
    for (const r of deRows) deMap.set(`${r.driver}|${r.emotion}`, r);

    const groups = new Map<
      string,
      { driver: string; emotion: string; count: number; scoreSum: number }
    >();
    for (const t of topics) {
      const key = `${t.humanDriver}|${t.emotion}`;
      const g = groups.get(key) ?? {
        driver: t.humanDriver,
        emotion: t.emotion,
        count: 0,
        scoreSum: 0,
      };
      g.count += 1;
      g.scoreSum += t.score ?? 0;
      groups.set(key, g);
    }
    const items: TopicEfficiencyItem[] = Array.from(groups.values()).map((g) => {
      const de = deMap.get(`${g.driver}|${g.emotion}`);
      return {
        driver: g.driver,
        emotion: g.emotion,
        topicCount: g.count,
        avgScore: g.count ? Number((g.scoreSum / g.count).toFixed(2)) : 0,
        avgPlay: de?.avgPlay ?? 0,
        avgConversion: de?.avgConversion ?? 0,
      };
    });
    items.sort((a, b) => b.avgScore - a.avgScore);
    return { items };
  }

  // —— 5. 人性钩子分析（7×6，复用 J 人性效能） ——

  async getHumanHook(): Promise<HumanHookView> {
    const rows = await this.recycleService.getDriverEfficiency();
    const items: HumanHookItem[] = rows.map((r) => ({
      driver: r.driver,
      emotion: r.emotion,
      sampleCount: r.sampleCount,
      avgPlay: r.avgPlay,
      avgInteractRate: r.avgInteractRate,
      avgConversion: r.avgConversion,
    }));
    return { items };
  }

  // —— 仪表盘配置 CRUD（ops_dashboards） ——

  async listDashboards(): Promise<DashboardEntity[]> {
    const tenantId = TenantContext.requireTenantId();
    return this.dashboardRepo.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
  }

  async createDashboard(dto: CreateDashboardDto): Promise<DashboardEntity> {
    const tenantId = TenantContext.requireTenantId();
    const entity = this.dashboardRepo.create({
      tenantId,
      name: dto.name,
      widgets: dto.widgets ?? null,
    });
    return this.dashboardRepo.save(entity);
  }

  async getDashboard(id: number): Promise<DashboardEntity> {
    const tenantId = TenantContext.requireTenantId();
    const entity = await this.dashboardRepo.findOne({ where: { id, tenantId } });
    if (!entity) throw new AppError('DASHBOARD_NOT_FOUND');
    return entity;
  }

  async updateDashboard(id: number, dto: UpdateDashboardDto): Promise<DashboardEntity> {
    const entity = await this.getDashboard(id);
    if (dto.name !== undefined) entity.name = dto.name;
    if (dto.widgets !== undefined) entity.widgets = dto.widgets;
    return this.dashboardRepo.save(entity);
  }

  async deleteDashboard(id: number): Promise<{ id: number }> {
    const entity = await this.getDashboard(id);
    await this.dashboardRepo.softRemove(entity);
    return { id };
  }

  // —— 内部聚合工具 ——

  private async sumInt<T extends ObjectLiteral>(
    repo: Repository<T>,
    column: string,
    tenantId: string,
  ): Promise<number> {
    const r = await repo
      .createQueryBuilder('t')
      .select(`SUM(t.${column})`, 'sum')
      .where('t.tenant_id = :tenantId', { tenantId })
      .getRawOne<{ sum: number | string | null }>();
    return Number(r?.sum ?? 0);
  }

  private async sumDecimal<T extends ObjectLiteral>(
    repo: Repository<T>,
    column: string,
    tenantId: string,
  ): Promise<number> {
    const r = await repo
      .createQueryBuilder('t')
      .select(`SUM(t.${column})`, 'sum')
      .where('t.tenant_id = :tenantId', { tenantId })
      .getRawOne<{ sum: number | string | null }>();
    return Number(r?.sum ?? 0);
  }

  private async sumFeedbackPlay(tenantId: string): Promise<number> {
    const feedbacks = await this.feedbackRepo.find({ where: { tenantId } });
    let play = 0;
    for (const f of feedbacks) play += (f.metrics as Metrics)?.play ?? 0;
    return play;
  }

  private async sumSpend(tenantId: string): Promise<number> {
    const [campaignSpend, metricCost] = await Promise.all([
      this.sumDecimal(this.adCampaignRepo, 'spend', tenantId),
      this.sumDecimal(this.adMetricRepo, 'cost', tenantId),
    ]);
    return Number((campaignSpend + metricCost).toFixed(2));
  }
}
