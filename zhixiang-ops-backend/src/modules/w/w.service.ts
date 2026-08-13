import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantContext } from '../../tenant/tenant-context';
import { AuditService } from '../../modules/n/audit.service';
import { AppError } from '../../shared/app-error';
import { AdMetricEntity } from '../../modules/s/ad-metric.entity';
import { RevenueRecordEntity, ReconciliationEntity, SettlementEntity } from './index';
import {
  RevenueRecordView,
  RevenueSummaryItem,
  ReconciliationView,
  SettlementView,
  SettlementPartyView,
  ProfitView,
} from './w.types';
import { CreateRevenueDto, ReconcileDto, SettleDto } from './dto';

/**
 * W 收益与对账（规划 §4-W）。
 * 业务范围：多收入汇总、佣金对账（关联 Y 订单）、分账（机构-达人-投手）、自动开票、利润统计。
 * 消费契约（§6）：← Y 订单(金额/佣金)；← S 投流(消耗/ROI)；← U 复购佣金。
 * 注：Y 订单模块尚未落地，related_order_id 关联与订单金额对账以 revenue 汇总兜底，待 Y 建后联调。
 */
@Injectable()
export class RevenueService {
  constructor(
    @InjectRepository(RevenueRecordEntity)
    private readonly revenueRepo: Repository<RevenueRecordEntity>,
    @InjectRepository(ReconciliationEntity)
    private readonly reconRepo: Repository<ReconciliationEntity>,
    @InjectRepository(SettlementEntity)
    private readonly settleRepo: Repository<SettlementEntity>,
    // 跨模块复用 S 投流指标（profit 计算消耗，对齐 §6 ← S 投流）
    @InjectRepository(AdMetricEntity)
    private readonly adMetricRepo: Repository<AdMetricEntity>,
    private readonly audit: AuditService,
  ) {}

  private toRevenueView(e: RevenueRecordEntity): RevenueRecordView {
    return {
      id: e.id,
      source: e.source,
      platform: e.platform,
      amount: Number(e.amount ?? 0),
      relatedOrderId: e.relatedOrderId ?? null,
      commission: Number(e.commission ?? 0),
      status: e.status,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    };
  }

  /** 录入收益记录（多收入：佣金/坑位费/服务费/打赏/补贴） */
  async recordRevenue(dto: CreateRevenueDto): Promise<RevenueRecordView> {
    const tenantId = TenantContext.requireTenantId();
    const e = this.revenueRepo.create({
      tenantId,
      source: dto.source as RevenueRecordEntity['source'],
      platform: dto.platform,
      amount: dto.amount,
      relatedOrderId: dto.relatedOrderId ?? null,
      commission: dto.commission ?? 0,
      status: (dto.status ?? 'pending') as RevenueRecordEntity['status'],
    });
    const saved = await this.revenueRepo.save(e);
    await this.audit.record({
      action: 'record_revenue',
      module: 'revenue',
      resource: `revenue:${saved.id}`,
    });
    return this.toRevenueView(saved);
  }

  /** 多收入汇总（按 source 分组 + 明细列表） */
  async listRevenue(
    source?: string,
  ): Promise<{ summary: RevenueSummaryItem[]; items: RevenueRecordView[] }> {
    const tenantId = TenantContext.requireTenantId();
    const where: Record<string, unknown> = { tenantId };
    if (source) where.source = source;
    const items = await this.revenueRepo.find({ where, order: { createdAt: 'DESC' } });

    const map = new Map<string, RevenueSummaryItem>();
    for (const e of items) {
      const cur = map.get(e.source) ?? { source: e.source, total: 0, count: 0 };
      cur.total = Number((cur.total + Number(e.amount ?? 0)).toFixed(2));
      cur.count += 1;
      map.set(e.source, cur);
    }
    return { summary: [...map.values()], items: items.map((e) => this.toRevenueView(e)) };
  }

  /** 生成对账（关联期内收益；Y 未建时按 revenue 汇总兜底） */
  async reconcile(dto: ReconcileDto): Promise<ReconciliationView> {
    const tenantId = TenantContext.requireTenantId();
    const list = await this.revenueRepo.find({ where: { tenantId } });
    const inPeriod = list.filter((e) => e.createdAt.toISOString().slice(0, 7) === dto.period);

    const orderAmount = Number(inPeriod.reduce((a, e) => a + Number(e.amount ?? 0), 0).toFixed(2));
    const commissionAmount = Number(
      inPeriod.reduce((a, e) => a + Number(e.commission ?? 0), 0).toFixed(2),
    );
    const settledAmount = Number(
      inPeriod
        .filter((e) => e.status === 'settled')
        .reduce((a, e) => a + Number(e.amount ?? 0), 0)
        .toFixed(2),
    );
    const diff = Number((orderAmount - settledAmount).toFixed(2));
    const status = diff === 0 ? 'matched' : 'diff_found';

    const e = this.reconRepo.create({
      tenantId,
      period: dto.period,
      orderAmount,
      commissionAmount,
      settledAmount,
      diff,
      status: status as ReconciliationEntity['status'],
    });
    const saved = await this.reconRepo.save(e);
    await this.audit.record({
      action: 'reconcile',
      module: 'revenue',
      resource: `reconciliation:${saved.id}`,
    });
    return this.toReconView(saved);
  }

  private toReconView(e: ReconciliationEntity): ReconciliationView {
    return {
      id: e.id,
      period: e.period,
      orderAmount: Number(e.orderAmount ?? 0),
      commissionAmount: Number(e.commissionAmount ?? 0),
      settledAmount: Number(e.settledAmount ?? 0),
      diff: Number(e.diff ?? 0),
      status: e.status,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    };
  }

  /** 对账明细 */
  async getReconciliation(id: number): Promise<ReconciliationView> {
    const tenantId = TenantContext.requireTenantId();
    const e = await this.reconRepo.findOne({ where: { id, tenantId } });
    if (!e) throw new AppError('RECONCILIATION_NOT_FOUND');
    return this.toReconView(e);
  }

  /**
   * 分账（机构-达人-投手）。
   * MVP 内嵌本地分账计算（校验各方合计 == 总额）；connected 模式接入管理系统时
   * 替换为 Commission 适配层真实分账（适配层桩见 integration/adapters.ts）。
   */
  async settle(dto: SettleDto): Promise<SettlementView> {
    const tenantId = TenantContext.requireTenantId();
    const partiesSum = Number(
      dto.parties.reduce((a, p) => a + Number(p.amount ?? 0), 0).toFixed(2),
    );
    if (Math.abs(partiesSum - Number(dto.amount)) > 0.01) {
      throw new AppError('SETTLEMENT_PARTIES_MISMATCH', '分账各方金额合计与总额不一致');
    }
    const parties: SettlementPartyView[] = dto.parties.map((p) => ({
      role: p.role,
      name: p.name,
      amount: Number(p.amount),
    }));
    const e = this.settleRepo.create({
      tenantId,
      type: dto.type as SettlementEntity['type'],
      parties,
      amount: dto.amount,
      status: (dto.status ?? 'pending') as SettlementEntity['status'],
    });
    const saved = await this.settleRepo.save(e);
    await this.audit.record({
      action: 'settle',
      module: 'revenue',
      resource: `settlement:${saved.id}`,
    });
    return this.toSettleView(saved);
  }

  private toSettleView(e: SettlementEntity): SettlementView {
    return {
      id: e.id,
      type: e.type,
      parties: (e.parties ?? []).map((p) => ({
        role: p.role,
        name: p.name,
        amount: Number(p.amount),
      })),
      amount: Number(e.amount ?? 0),
      status: e.status,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    };
  }

  /**
   * 自动开票（MVP 内嵌生成发票号；真实开票留待 Commission 适配层/管理系统）。
   */
  async invoice(id: number): Promise<{ settlementId: number; invoiceNo: string; status: string }> {
    const tenantId = TenantContext.requireTenantId();
    const e = await this.settleRepo.findOne({ where: { id, tenantId } });
    if (!e) throw new AppError('SETTLEMENT_NOT_FOUND');
    e.status = 'invoiced';
    const saved = await this.settleRepo.save(e);
    const invoiceNo = `INV-${saved.id}-${Date.now()}`;
    await this.audit.record({
      action: 'invoice',
      module: 'revenue',
      resource: `settlement:${saved.id}`,
    });
    return { settlementId: saved.id, invoiceNo, status: saved.status };
  }

  /** 利润统计：总收入 - 投流消耗（S ad_metrics 汇总，对齐 §6 ← S 投流） */
  async profit(): Promise<ProfitView> {
    const tenantId = TenantContext.requireTenantId();
    const revenues = await this.revenueRepo.find({ where: { tenantId } });
    const totalRevenue = Number(revenues.reduce((a, e) => a + Number(e.amount ?? 0), 0).toFixed(2));
    const totalCommission = Number(
      revenues.reduce((a, e) => a + Number(e.commission ?? 0), 0).toFixed(2),
    );
    const metrics = await this.adMetricRepo.find({ where: { tenantId } });
    const totalAdCost = Number(metrics.reduce((a, m) => a + Number(m.cost ?? 0), 0).toFixed(2));
    const netProfit = Number((totalRevenue - totalAdCost).toFixed(2));
    return { totalRevenue, totalCommission, totalAdCost, netProfit };
  }
}
