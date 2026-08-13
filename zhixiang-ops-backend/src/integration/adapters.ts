import { AppError } from '../shared/app-error';

/**
 * 适配层接口（规划 §7 / §17，双模式）。
 * 运营系统经这些接口调用管理系统能力（SSO / 商品 / 订单 / 佣金），
 * 业务模块只依赖接口，不感知 standalone / connected 实现差异。
 */

export type IntegrationMode = 'standalone' | 'connected';

export interface ProductDTO {
  id: string;
  title: string;
  price?: number;
  imageUrl?: string;
}

/** 商品 / 挂车适配（I 发布挂车、R 商品内容、T 选品） */
export interface ProductAdapter {
  getProduct(id: string): Promise<ProductDTO>;
  /** 按外部商品ID批量拉取（T 选品导入 / R 商品内容） */
  getProductsByIds(ids: string[]): Promise<ProductDTO[]>;
  /** 分页列表（P3 主数据同步 / T 选品库展示，对齐管理系统 /api/admin/products） */
  listProducts(params: Record<string, unknown>): Promise<ProductDTO[]>;
  /** 绑定挂车商品到某账号，返回平台挂车商品 ID */
  bindCart(productId: string, accountId: string): Promise<{ cartProductId: string }>;
}

/** 订单 / 库存适配（Y 订单物流、W 对账） */
export interface OrderAdapter {
  listOrders(tenantId: string, params: Record<string, unknown>): Promise<unknown[]>;
  getOrder(tenantId: string, orderId: string): Promise<unknown>;
  /** 库存查询（管理系统为真源，运营只读展示，对齐 /api/admin/inventory） */
  queryStock(tenantId: string, sku?: string): Promise<unknown>;
  /** 挂车转化推单回管理系统（订单创建，幂等键 order_id 由运营生成） */
  pushOrder(tenantId: string, order: Record<string, unknown>): Promise<unknown>;
}

/** 佣金 / 财务适配（W 对账） */
export interface CommissionAdapter {
  getCommissionSummary(tenantId: string): Promise<unknown>;
  /** 财务报表（对账/利润/报表，对齐 /api/admin/financial） */
  queryFinancial(tenantId: string, params: Record<string, unknown>): Promise<unknown>;
  /** 分账结果回写（对齐 /api/admin/settlement） */
  settleCommission(tenantId: string, settlement: Record<string, unknown>): Promise<unknown>;
}

/** 统一账号（SSO）适配（接入管理系统） */
export interface AuthAdapter {
  ssoLogin(tenantId: string): Promise<{ url: string }>;
  verifyToken(token: string): Promise<{ tenantId: string; userId: number }>;
  syncTenant(tenantId: string): Promise<void>;
  listAccounts(tenantId: string): Promise<unknown[]>;
}

/**
 * 未实现适配（standalone 模式默认）。
 * 所有接口统一抛 NOT_IMPLEMENTED，业务经接口调用不感知模式差异；
 * connected 模式接入管理系统时替换为真实实现。
 */
export class NotImplementedAdapter
  implements ProductAdapter, OrderAdapter, CommissionAdapter, AuthAdapter
{
  private fail(): never {
    throw new AppError('NOT_IMPLEMENTED');
  }

  getProduct(): Promise<ProductDTO> {
    return this.fail();
  }
  getProductsByIds(): Promise<ProductDTO[]> {
    return this.fail();
  }
  listProducts(): Promise<ProductDTO[]> {
    return this.fail();
  }
  bindCart(): Promise<{ cartProductId: string }> {
    return this.fail();
  }
  listOrders(): Promise<unknown[]> {
    return this.fail();
  }
  getOrder(): Promise<unknown> {
    return this.fail();
  }
  queryStock(): Promise<unknown> {
    return this.fail();
  }
  pushOrder(): Promise<unknown> {
    return this.fail();
  }
  getCommissionSummary(): Promise<unknown> {
    return this.fail();
  }
  queryFinancial(): Promise<unknown> {
    return this.fail();
  }
  settleCommission(): Promise<unknown> {
    return this.fail();
  }
  ssoLogin(): Promise<{ url: string }> {
    return this.fail();
  }
  verifyToken(): Promise<{ tenantId: string; userId: number }> {
    return this.fail();
  }
  syncTenant(): Promise<void> {
    return this.fail();
  }
  listAccounts(): Promise<unknown[]> {
    return this.fail();
  }
}
