import type { OrderSource, OrderStatus, LogisticsStatus } from './order.entity';
import type { WaybillPrintStatus } from './waybill.entity';

export interface BuyerView {
  name: string; // 脱敏：仅首字
  phone: string; // 脱敏：中间四位 ****
  address: string; // 脱敏：截断 + ***
  buyerRef?: string;
}

export interface OrderView {
  id: number;
  source: OrderSource;
  platform: string;
  orderId: string;
  productId: number | null;
  quantity: number;
  amount: number;
  commission: number;
  status: OrderStatus;
  logisticsStatus: LogisticsStatus;
  attributionId: string | null;
  buyer: BuyerView | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LogisticsTrackView {
  id: number;
  orderId: number;
  carrier: string;
  trackingNo: string;
  status: string;
  node: string;
  ts: Date;
}

export interface WaybillView {
  id: number;
  orderId: number;
  carrier: string;
  trackingNo: string;
  printStatus: WaybillPrintStatus;
  printedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncOrdersResult {
  total: number;
  created: number;
  updated: number;
}

export interface InventoryWarnItem {
  id: number;
  title: string;
  stock: number;
}

export interface PlatformOrderInput {
  orderId: string;
  platform: string;
  productId?: number;
  quantity?: number;
  amount: number;
  commission?: number;
  status?: OrderStatus;
  attributionId?: string;
  buyer?: { name: string; phone: string; address: string; buyerRef?: string };
}
