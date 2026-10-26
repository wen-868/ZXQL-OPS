/**
 * 电商自动上下架类型与枚举（电商平台适配层）。
 * 设计目标：统一上/下架接口 + 各大平台规则差异（类目资质/标题限制/审核机制/库存行为/定时能力），
 * 规则化模拟优先（对齐系统现有 douyin-client 降级模式），真实 API 按平台凭证就绪后替换适配器实现。
 */

/** 电商平台枚举（国内 6 + 海外 3） */
export type EcommercePlatform =
  | 'douyin-shop' // 抖店（抖音电商）
  | 'taobao' // 淘宝/天猫
  | 'pdd' // 拼多多
  | 'jd' // 京东
  | 'kuaishou-shop' // 快手小店
  | 'wechat-shop' // 视频号小店
  | 'amazon' // 亚马逊
  | 'shopify' // Shopify
  | 'tiktok-shop'; // TikTok Shop

export const ECOMMERCE_PLATFORMS: EcommercePlatform[] = [
  'douyin-shop',
  'taobao',
  'pdd',
  'jd',
  'kuaishou-shop',
  'wechat-shop',
  'amazon',
  'shopify',
  'tiktok-shop',
];

/** 上下架策略类型（自动上下架的触发规则） */
export type ShelfStrategyType = 'inventory' | 'time' | 'price' | 'compliance' | 'weight';

export const SHELF_STRATEGIES: ShelfStrategyType[] = [
  'inventory',
  'time',
  'price',
  'compliance',
  'weight',
];

/** 动作（up=上架，down=下架，auto=按策略自动决定） */
export type ShelfAction = 'up' | 'down' | 'publish';
export type RuleAction = ShelfAction | 'auto';

/** 商品在平台的上下架状态 */
export type ShelfStatus = 'on_sale' | 'off_sale' | 'pending_review' | 'unknown';

/** 执行记录状态 */
export type ShelfJobStatus = 'queued' | 'done' | 'failed' | 'skipped';

/** 平台规则差异元信息（各平台适配的核心差异点，规则化供调度与前端展示） */
export interface PlatformRuleMeta {
  platform: EcommercePlatform;
  name: string;
  region: 'cn' | 'global';
  /** 上架是否需要平台审核（异步审核流程，模拟审核时长为 reviewSimMinutes 现实分钟） */
  reviewRequired: boolean;
  /** 模拟审核通过所需现实分钟数（真实 API 时替换为平台异步审核回调） */
  reviewSimMinutes: number;
  /** 标题最大长度（字符） */
  titleMaxLen: number;
  /** 下架是否保留商品资料（如淘宝 7 天可恢复、亚马逊 Listing 保留、Shopify 保留） */
  downKeepsListing: boolean;
  /** 平台是否库存为 0 自动下架 */
  autoDownOnZeroStock: boolean;
  /** 是否支持定时上下架 */
  timedShelf: boolean;
  /** 在线商品数上限（null 表示无硬性限制） */
  maxOnlineProducts: number | null;
  /** 上架前平台要求的字段/资质（规则化说明） */
  fieldRules: string[];
}

/** 各平台规则差异（维护点：新增平台在此登记，并实现对应适配器） */
export const ECOMMERCE_PLATFORM_META: Record<EcommercePlatform, PlatformRuleMeta> = {
  'douyin-shop': {
    platform: 'douyin-shop',
    name: '抖店（抖音电商）',
    region: 'cn',
    reviewRequired: true,
    reviewSimMinutes: 1,
    titleMaxLen: 128,
    downKeepsListing: true,
    autoDownOnZeroStock: false,
    timedShelf: true,
    maxOnlineProducts: null,
    fieldRules: ['类目资质', '保证金', '带货资质'],
  },
  taobao: {
    platform: 'taobao',
    name: '淘宝/天猫',
    region: 'cn',
    reviewRequired: false,
    reviewSimMinutes: 0,
    titleMaxLen: 60,
    downKeepsListing: true,
    autoDownOnZeroStock: true,
    timedShelf: true,
    maxOnlineProducts: 1000,
    fieldRules: ['类目属性完整', '品牌授权', '违禁词过滤'],
  },
  pdd: {
    platform: 'pdd',
    name: '拼多多',
    region: 'cn',
    reviewRequired: true,
    reviewSimMinutes: 1,
    titleMaxLen: 60,
    downKeepsListing: true,
    autoDownOnZeroStock: true,
    timedShelf: false,
    maxOnlineProducts: null,
    fieldRules: ['类目资质', '品牌资质', '低价引流规则'],
  },
  jd: {
    platform: 'jd',
    name: '京东',
    region: 'cn',
    reviewRequired: false,
    reviewSimMinutes: 0,
    titleMaxLen: 50,
    downKeepsListing: true,
    autoDownOnZeroStock: true,
    timedShelf: true,
    maxOnlineProducts: null,
    fieldRules: ['POP 类目授权'],
  },
  'kuaishou-shop': {
    platform: 'kuaishou-shop',
    name: '快手小店',
    region: 'cn',
    reviewRequired: true,
    reviewSimMinutes: 1,
    titleMaxLen: 60,
    downKeepsListing: true,
    autoDownOnZeroStock: true,
    timedShelf: false,
    maxOnlineProducts: null,
    fieldRules: ['类目审核', '部分类目人工审核'],
  },
  'wechat-shop': {
    platform: 'wechat-shop',
    name: '视频号小店',
    region: 'cn',
    reviewRequired: true,
    reviewSimMinutes: 2,
    titleMaxLen: 50,
    downKeepsListing: true,
    autoDownOnZeroStock: true,
    timedShelf: false,
    maxOnlineProducts: null,
    fieldRules: ['类目资质严格', '橱窗商品管理'],
  },
  amazon: {
    platform: 'amazon',
    name: '亚马逊',
    region: 'global',
    reviewRequired: true,
    reviewSimMinutes: 3,
    titleMaxLen: 200,
    downKeepsListing: true,
    autoDownOnZeroStock: true,
    timedShelf: false,
    maxOnlineProducts: null,
    fieldRules: ['类目审批（Category Approval）', '商品政策', '变体关系'],
  },
  shopify: {
    platform: 'shopify',
    name: 'Shopify',
    region: 'global',
    reviewRequired: false,
    reviewSimMinutes: 0,
    titleMaxLen: 255,
    downKeepsListing: true,
    autoDownOnZeroStock: false,
    timedShelf: true,
    maxOnlineProducts: null,
    fieldRules: ['销售渠道发布', '多库存地点'],
  },
  'tiktok-shop': {
    platform: 'tiktok-shop',
    name: 'TikTok Shop',
    region: 'global',
    reviewRequired: true,
    reviewSimMinutes: 1,
    titleMaxLen: 255,
    downKeepsListing: true,
    autoDownOnZeroStock: true,
    timedShelf: true,
    maxOnlineProducts: null,
    fieldRules: ['类目资质', '商品审核', '保证金'],
  },
};

/** 上架前平台预检结果 */
export interface PrecheckResult {
  ok: boolean;
  reason?: string;
}

/** 平台执行结果（上/下架回执） */
export interface ShelfPlatformResult {
  status: ShelfStatus;
  extShelfId: string;
  /** 是否进入平台异步审核 */
  reviewPending?: boolean;
}

/** 平台商品发布入参（流水线"自动发布到各大平台"环节使用） */
export interface PublishProductInput {
  title: string;
  category?: string | null;
  price?: number | null;
  stock: number;
  imageUrl?: string;
  tenantId: string;
  platform: EcommercePlatform;
}

/** 平台商品发布回执（创建 Listing） */
export interface PublishProductResult {
  extProductId: string;
  status: ShelfStatus;
  reviewPending?: boolean;
}

/** 平台适配器接口（统一上/下架，各平台实现差异） */
export interface ShelfAdapter {
  readonly meta: PlatformRuleMeta;
  /** 上架前平台规则预检（类目资质/标题长度/合规词等） */
  precheck(
    product: { title: string; category?: string | null },
    ruleParams?: Record<string, unknown> | null,
  ): Promise<PrecheckResult>;
  /** 上架：返回平台回执（含审核流转） */
  up(
    product: { title: string; id: number; tenantId: string; category?: string | null },
    ruleParams?: Record<string, unknown> | null,
  ): Promise<ShelfPlatformResult>;
  /** 下架：立即生效（是否保留资料由 meta.downKeepsListing 决定） */
  down(
    product: { title: string; id: number; tenantId: string; category?: string | null },
    ruleParams?: Record<string, unknown> | null,
  ): Promise<ShelfPlatformResult>;
  /** 发布商品（平台创建 Listing：标题/类目/价格/库存/图片 → 平台商品 ID + 上架流转） */
  publishProduct(input: PublishProductInput): Promise<PublishProductResult>;
}
