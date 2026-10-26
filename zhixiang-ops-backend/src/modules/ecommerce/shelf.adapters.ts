import { AppError } from '../../shared/app-error';
import { ComplianceService } from '../compliance/compliance.service';
import {
  EcommercePlatform,
  ECOMMERCE_PLATFORM_META,
  PlatformRuleMeta,
  PrecheckResult,
  PublishProductInput,
  PublishProductResult,
  ShelfAdapter,
  ShelfPlatformResult,
} from './ecommerce.types';

/**
 * 电商平台适配器（规则化模拟优先）。
 * 统一接口上/下架；各平台差异由 meta（类目资质/标题限制/审核机制/库存行为）与行为函数体现。
 * 真实 API 配齐凭证后，以各平台开放平台 SDK 替换对应方法（保留 meta 规则与回执结构）。
 */

/** 生成平台外部上架 ID（模拟回执，真实 API 为平台返回） */
function mockExtShelfId(tenantId: string, platform: EcommercePlatform, productId: number): string {
  return `shelf_${tenantId}_${platform}_${productId}`;
}

/** 模拟平台异步审核：reviewRequired 平台返回 pending_review（Cron 周期按 reviewSimMinutes 通过） */
class MockShelfAdapterBase {
  constructor(public readonly meta: PlatformRuleMeta) {}

  // 接口契约为 Promise；纯规则校验无异步操作
  // eslint-disable-next-line @typescript-eslint/require-await
  async precheck(product: { title: string; category?: string | null }): Promise<PrecheckResult> {
    const titleLen = Array.from(product.title).length;
    if (titleLen > this.meta.titleMaxLen) {
      return {
        ok: false,
        reason: `${this.meta.name} 标题超长（${titleLen} > ${this.meta.titleMaxLen} 字）`,
      };
    }
    if (this.meta.fieldRules.includes('类目资质') && !product.category) {
      return { ok: false, reason: `${this.meta.name} 要求类目资质，商品缺少类目` };
    }
    return { ok: true };
  }

  async up(product: {
    title: string;
    id: number;
    tenantId: string;
    category?: string | null;
  }): Promise<ShelfPlatformResult> {
    const pre = await this.precheck(product);
    if (!pre.ok) throw new AppError('SHELF_PRECHECK_FAILED', pre.reason);
    const extShelfId = mockExtShelfId(product.tenantId, this.meta.platform, product.id);
    if (this.meta.reviewRequired) {
      return { status: 'pending_review', extShelfId, reviewPending: true };
    }
    return { status: 'on_sale', extShelfId };
  }

  // 接口契约为 Promise；下架为同步回执
  // eslint-disable-next-line @typescript-eslint/require-await
  async down(product: {
    title: string;
    id: number;
    tenantId: string;
    category?: string | null;
  }): Promise<ShelfPlatformResult> {
    return {
      status: 'off_sale',
      extShelfId: mockExtShelfId(product.tenantId, this.meta.platform, product.id),
    };
  }

  async publishProduct(input: PublishProductInput): Promise<PublishProductResult> {
    const pre = await this.precheck({ title: input.title, category: input.category });
    if (!pre.ok) throw new AppError('SHELF_PRECHECK_FAILED', pre.reason);
    const extProductId = `prod_${input.tenantId}_${this.meta.platform}_${Date.now()}`;
    if (this.meta.reviewRequired) {
      return { extProductId, status: 'pending_review', reviewPending: true };
    }
    return { extProductId, status: 'on_sale' };
  }
}

/** 抖店：上架需类目资质/保证金，审核 1 分钟模拟通过，支持定时上下架 */
class DouyinShopAdapter extends MockShelfAdapterBase {
  constructor() {
    super(ECOMMERCE_PLATFORM_META['douyin-shop']);
  }
}

/** 淘宝/天猫：即时上架无审核，标题 60 字，库存为 0 平台自动下架，可定时上架，在线商品上限 1000 */
class TaobaoAdapter extends MockShelfAdapterBase {
  constructor() {
    super(ECOMMERCE_PLATFORM_META.taobao);
  }
}

/** 拼多多：上架审核（1 分钟模拟），库存为 0 自动下架，不支持定时 */
class PddAdapter extends MockShelfAdapterBase {
  constructor() {
    super(ECOMMERCE_PLATFORM_META.pdd);
  }
}

/** 京东：POP 类目授权，即时上架，库存为 0 自动下架，可定时上下架 */
class JdAdapter extends MockShelfAdapterBase {
  constructor() {
    super(ECOMMERCE_PLATFORM_META.jd);
  }
}

/** 快手小店：类目审核（部分人工），库存为 0 自动下架 */
class KuaishouShopAdapter extends MockShelfAdapterBase {
  constructor() {
    super(ECOMMERCE_PLATFORM_META['kuaishou-shop']);
  }
}

/** 视频号小店：类目资质严格，审核 2 分钟模拟通过，库存为 0 自动下架 */
class WechatShopAdapter extends MockShelfAdapterBase {
  constructor() {
    super(ECOMMERCE_PLATFORM_META['wechat-shop']);
  }
}

/** 亚马逊：类目审批 + 商品政策，审核 3 分钟模拟通过，库存为 0 自动 Inactive（Listing 保留） */
class AmazonAdapter extends MockShelfAdapterBase {
  constructor() {
    super(ECOMMERCE_PLATFORM_META.amazon);
  }
}

/** Shopify：无审核即时上架，支持定时与多渠道，库存为 0 不自动下架（可配置） */
class ShopifyAdapter extends MockShelfAdapterBase {
  constructor() {
    super(ECOMMERCE_PLATFORM_META.shopify);
  }
}

/** TikTok Shop：类目资质+审核（1 分钟模拟），库存为 0 自动下架，支持定时 */
class TiktokShopAdapter extends MockShelfAdapterBase {
  constructor() {
    super(ECOMMERCE_PLATFORM_META['tiktok-shop']);
  }
}

/** 适配器注册表：平台 → 适配器实例（单例） */
export const SHELF_ADAPTERS: Record<EcommercePlatform, ShelfAdapter> = {
  'douyin-shop': new DouyinShopAdapter(),
  taobao: new TaobaoAdapter(),
  pdd: new PddAdapter(),
  jd: new JdAdapter(),
  'kuaishou-shop': new KuaishouShopAdapter(),
  'wechat-shop': new WechatShopAdapter(),
  amazon: new AmazonAdapter(),
  shopify: new ShopifyAdapter(),
  'tiktok-shop': new TiktokShopAdapter(),
};

/** 合规预检依赖注入包装（compliance 策略使用，避免适配器依赖 Nest 作用域） */
export type ComplianceScanner = Pick<ComplianceService, 'checkText'>;
