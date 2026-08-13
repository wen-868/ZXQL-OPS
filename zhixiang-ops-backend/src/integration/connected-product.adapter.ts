import { AppError } from '../shared/app-error';
import { MsApiClient } from './ms-client';
import { ProductAdapter, ProductDTO } from './adapters';

/** 宽容取字符串：按序返回首个 string/number/boolean；其余（对象/缺失）回退下一个取值 */
function str(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  }
  return '';
}

/** 管理系统商品行 → 运营 ProductDTO（宽容映射，字段缺失不阻断） */
function mapProduct(row: Record<string, unknown>): ProductDTO {
  return {
    id: str(row.id, row.spuId, row.skuId, row.skuCode),
    title: str(row.name, row.title, row.skuName),
    price: Number(row.retailPrice ?? row.wholesalePrice ?? row.miniappPrice ?? 0) || undefined,
    imageUrl: row.mainImage ? str(row.mainImage) : undefined,
  };
}

/**
 * 管理系统商品适配器（connected 模式，方案 §18-③）。
 * 商品主数据为管理系统真源：运营侧只读展示，写操作归管理系统。
 */
export class ConnectedProductAdapter implements ProductAdapter {
  constructor(private readonly client: MsApiClient) {}

  async getProduct(id: string): Promise<ProductDTO> {
    const data = await this.client.request<Record<string, unknown>>(
      'GET',
      `/admin/products/${id}`,
      { tenantId: 'default' },
    );
    return mapProduct(data);
  }

  async getProductsByIds(ids: string[]): Promise<ProductDTO[]> {
    const results = await Promise.all(ids.map((id) => this.getProduct(id).catch(() => null)));
    return results.filter((r): r is ProductDTO => r !== null);
  }

  async listProducts(params: Record<string, unknown>): Promise<ProductDTO[]> {
    const tenantId = str(params.tenantId, 'default');
    const data = await this.client.request<{ list?: Record<string, unknown>[] }>(
      'GET',
      '/admin/products',
      {
        tenantId,
        query: { page: params.page, pageSize: params.pageSize, keyword: params.keyword },
      },
    );
    return (data.list ?? []).map(mapProduct);
  }

  bindCart(_productId: string, _accountId: string): Promise<{ cartProductId: string }> {
    // connected 模式挂车为平台侧能力（抖音挂车等），管理系统无挂车概念 → 保持占位
    throw new AppError('NOT_IMPLEMENTED');
  }
}
