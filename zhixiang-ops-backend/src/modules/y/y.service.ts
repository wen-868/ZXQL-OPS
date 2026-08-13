import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantContext } from '../../tenant/tenant-context';
import { AuditService } from '../../modules/n/audit.service';
import { AppError } from '../../shared/app-error';
import { IntegrationService } from '../../integration/integration.service';
import { ProductService } from '../../modules/r/product.service';
import { encryptJSON, decryptJSON } from '../../shared/crypto';
import { OrderEntity, LogisticsTrackEntity, WaybillEntity } from './index';
import type { OrderStatus } from './order.entity';
import {
  OrderView,
  LogisticsTrackView,
  WaybillView,
  SyncOrdersResult,
  InventoryWarnItem,
  BuyerView,
} from './y.types';
import { SyncOrdersDto, CreateWaybillDto, BatchWaybillDto, SyncInventoryDto } from './dto';

/** 扣减库存的订单状态（已支付/发货/完成） */
const STOCK_DEDUCT_STATUSES: OrderStatus[] = ['paid', 'shipped', 'completed'];

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(OrderEntity) private orderRepo: Repository<OrderEntity>,
    @InjectRepository(LogisticsTrackEntity) private trackRepo: Repository<LogisticsTrackEntity>,
    @InjectRepository(WaybillEntity) private waybillRepo: Repository<WaybillEntity>,
    private product: ProductService,
    private integration: IntegrationService,
    private audit: AuditService,
  ) {}

  /** 收货信息脱敏（展示层） */
  private maskBuyer(raw: {
    name?: string;
    phone?: string;
    address?: string;
    buyerRef?: string;
  }): BuyerView {
    const phone = raw.phone ? raw.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : '';
    const address = raw.address
      ? raw.address.length > 6
        ? raw.address.slice(0, 6) + '***'
        : raw.address
      : '';
    return {
      name: raw.name ? raw.name.slice(0, 1) + '*' : '',
      phone,
      address,
      buyerRef: raw.buyerRef,
    };
  }

  private toOrderView(e: OrderEntity): OrderView {
    let buyer: BuyerView | null = null;
    if (e.buyerInfo) {
      try {
        buyer = this.maskBuyer(
          decryptJSON<{ name?: string; phone?: string; address?: string; buyerRef?: string }>(
            e.buyerInfo,
          ),
        );
      } catch {
        buyer = null;
      }
    }
    return {
      id: e.id,
      source: e.source,
      platform: e.platform,
      orderId: e.orderId,
      productId: e.productId ?? null,
      quantity: e.quantity,
      amount: Number(e.amount ?? 0),
      commission: Number(e.commission ?? 0),
      status: e.status,
      logisticsStatus: e.logisticsStatus,
      attributionId: e.attributionId ?? null,
      buyer,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    };
  }

  private toWaybillView(e: WaybillEntity): WaybillView {
    return {
      id: e.id,
      orderId: e.orderId,
      carrier: e.carrier,
      trackingNo: e.trackingNo,
      printStatus: e.printStatus,
      printedAt: e.printedAt ?? null,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    };
  }

  /**
   * 同步订单（双源接入：management 管理系统适配层 / platform 平台开放订单）。
   * 幂等：以 (tenantId, orderId) 去重；已存在且状态未变则跳过，状态变化则更新。
   * 库存联动：新同步且状态为已支付/发货/完成时扣减 R 库存单一真源（防超卖以应用层顺序写兜底，分布式锁留待增强）。
   */
  async syncOrders(dto: SyncOrdersDto): Promise<SyncOrdersResult> {
    const tenantId = TenantContext.requireTenantId();
    if (!dto.orders || dto.orders.length === 0) {
      throw new AppError('ORDER_SYNC_EMPTY');
    }
    // 双源接入：connected 模式（经管理系统适配层）默认 source=management；standalone 默认 platform
    const source = dto.source ?? (this.integration.isStandalone() ? 'platform' : 'management');
    let created = 0;
    let updated = 0;
    for (const item of dto.orders) {
      const existing = await this.orderRepo.findOne({ where: { tenantId, orderId: item.orderId } });
      const buyerEnc = item.buyer ? encryptJSON(item.buyer) : null;
      const status = item.status ?? 'paid';
      if (existing) {
        if (existing.status !== status) {
          existing.status = status;
          await this.orderRepo.save(existing);
          updated++;
        }
        continue;
      }
      const e = this.orderRepo.create({
        tenantId,
        source,
        platform: item.platform,
        orderId: item.orderId,
        productId: item.productId ?? null,
        quantity: item.quantity ?? 1,
        amount: item.amount,
        commission: item.commission ?? 0,
        status,
        attributionId: item.attributionId ?? null,
        buyerInfo: buyerEnc,
      });
      if (STOCK_DEDUCT_STATUSES.includes(status) && e.productId) {
        await this.product.updateStock(e.productId, { delta: -(e.quantity ?? 1) });
      }
      await this.orderRepo.save(e);
      created++;
    }
    await this.audit.record({
      action: 'sync_orders',
      module: 'order',
      resource: `orders:${tenantId}`,
    });
    return { total: dto.orders.length, created, updated };
  }

  async listOrders(filter: { status?: string; platform?: string } = {}): Promise<OrderView[]> {
    const tenantId = TenantContext.requireTenantId();
    const where: Record<string, unknown> = { tenantId };
    if (filter.status) where.status = filter.status;
    if (filter.platform) where.platform = filter.platform;
    const rows = await this.orderRepo.find({ where, order: { createdAt: 'DESC' } });
    return rows.map((e) => this.toOrderView(e));
  }

  async getOrder(id: number): Promise<OrderView> {
    const tenantId = TenantContext.requireTenantId();
    const e = await this.orderRepo.findOne({ where: { id, tenantId } });
    if (!e) throw new AppError('ORDER_NOT_FOUND');
    return this.toOrderView(e);
  }

  /** 退款：状态置 refunded 并回写库存 */
  async refund(id: number): Promise<OrderView> {
    const tenantId = TenantContext.requireTenantId();
    const e = await this.orderRepo.findOne({ where: { id, tenantId } });
    if (!e) throw new AppError('ORDER_NOT_FOUND');
    if (e.status !== 'refunded') {
      e.status = 'refunded';
      await this.orderRepo.save(e);
      if (e.productId) {
        await this.product.updateStock(e.productId, { delta: e.quantity ?? 1 });
      }
    }
    await this.audit.record({ action: 'refund_order', module: 'order', resource: `order:${id}` });
    return this.toOrderView(e);
  }

  async getLogisticsTrack(orderId: number): Promise<LogisticsTrackView[]> {
    const tenantId = TenantContext.requireTenantId();
    const rows = await this.trackRepo.find({ where: { tenantId, orderId }, order: { ts: 'ASC' } });
    return rows.map((t) => ({
      id: t.id,
      orderId: t.orderId,
      carrier: t.carrier,
      trackingNo: t.trackingNo,
      status: t.status,
      node: t.node,
      ts: t.ts,
    }));
  }

  /** 生成电子面单（MVP 平台面单 API 桩：本地生成运单号） */
  async createWaybill(orderId: number, dto: CreateWaybillDto): Promise<WaybillView> {
    const tenantId = TenantContext.requireTenantId();
    const order = await this.orderRepo.findOne({ where: { id: orderId, tenantId } });
    if (!order) throw new AppError('ORDER_NOT_FOUND');
    const trackingNo = `WB-${orderId}-${Date.now()}`;
    const e = this.waybillRepo.create({
      tenantId,
      orderId,
      carrier: dto.carrier ?? 'default',
      trackingNo,
      printStatus: 'pending',
      printedAt: null,
    });
    const saved = await this.waybillRepo.save(e);
    await this.audit.record({
      action: 'create_waybill',
      module: 'order',
      resource: `order:${orderId}`,
    });
    return this.toWaybillView(saved);
  }

  async batchWaybill(dto: BatchWaybillDto): Promise<{ count: number }> {
    const tenantId = TenantContext.requireTenantId();
    let count = 0;
    for (const orderId of dto.orderIds) {
      const order = await this.orderRepo.findOne({ where: { id: orderId, tenantId } });
      if (!order) continue;
      const trackingNo = `WB-${orderId}-${Date.now()}-${count}`;
      await this.waybillRepo.save(
        this.waybillRepo.create({
          tenantId,
          orderId,
          carrier: dto.carrier ?? 'default',
          trackingNo,
          printStatus: 'pending',
          printedAt: null,
        }),
      );
      count++;
    }
    await this.audit.record({
      action: 'batch_waybill',
      module: 'order',
      resource: `orders:${tenantId}`,
    });
    return { count };
  }

  /** 仓储库存回传：经 R 库存单一真源回写 */
  async syncInventory(dto: SyncInventoryDto): Promise<{ productId: number; stock: number }> {
    TenantContext.requireTenantId();
    const v = await this.product.updateStock(dto.productId, {
      delta: dto.delta,
      reason: dto.reason,
    });
    await this.audit.record({
      action: 'sync_inventory',
      module: 'order',
      resource: `product:${dto.productId}`,
    });
    return { productId: dto.productId, stock: v.stock };
  }

  /** 库存预警：列出库存 <= 阈值的商品 */
  async inventoryWarn(threshold = 10): Promise<InventoryWarnItem[]> {
    TenantContext.requireTenantId();
    const products = await this.product.list();
    return products
      .filter((p) => p.stock <= threshold)
      .map((p) => ({ id: p.id, title: p.title, stock: p.stock }));
  }
}
