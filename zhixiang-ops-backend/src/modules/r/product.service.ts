import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppError } from '../../shared/app-error';
import { TenantContext } from '../../tenant/tenant-context';
import { HUMANITIES, Humanity } from '../../core/humanity-emotion';
import { IntegrationService } from '../../integration/integration.service';
import { SkillGateway } from '../../skill/skill.gateway';
import { AuditService } from '../n/audit.service';
import { SelectionProductEntity } from '../t/selection-product.entity';
import { ProductEntity } from './product.entity';
import { ProductContentEntity } from './product-content.entity';
import { ProductDetailPageEntity } from './product-detail-page.entity';
import {
  ComplianceRisk,
  ContentPlatform,
  ProductContentView,
  ProductDetailPageView,
  ProductView,
  toProductContentView,
  toProductDetailPageView,
  toProductView,
} from './r.types';
import { CreateProductDto } from './dto/create-product.dto';
import { GenerateContentDto } from './dto/generate-content.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { CreateDetailPageDto } from './dto/create-detail-page.dto';

/**
 * 合规内嵌兜底（P 违禁词模块阶段补完）：基础违禁/绝对化词表。
 * 当前为最小化实现，覆盖常见绝对化与医疗宣称类违规词；完整词库由 P 模块接入。
 */
const BANNED_WORDS = [
  '最',
  '第一',
  '国家级',
  '世界级',
  '特效',
  '根治',
  '百分百',
  '绝对',
  '永久',
  '立即见效',
  '最好',
  '顶级',
  '万能',
  '包治',
  '无副作用',
];
// 高危词（命中即 high 风险）
const HIGH_RISK_WORDS = ['国家级', '世界级', '根治', '包治', '特效', '无副作用', '永久'];

/** 三源接入公共字段（dto 显式值优先，缺省由各来源补齐） */
type ProductSourceFields = {
  title?: string;
  humanDriver?: string;
  price?: number;
  category?: string;
};

/** 选品记录字段（用于缺省补齐，null 视同未填） */
type SelectionFields = Pick<SelectionProductEntity, 'title' | 'humanDriver' | 'price' | 'category'>;

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    @InjectRepository(ProductContentEntity)
    private readonly contentRepo: Repository<ProductContentEntity>,
    @InjectRepository(ProductDetailPageEntity)
    private readonly detailRepo: Repository<ProductDetailPageEntity>,
    @InjectRepository(SelectionProductEntity)
    private readonly selectionRepo: Repository<SelectionProductEntity>,
    private readonly integration: IntegrationService,
    private readonly skill: SkillGateway,
    private readonly audit: AuditService,
  ) {}

  /** null 归一为 undefined（选品补齐时 null 视同未填） */
  private static orUndef<T>(v: T | null | undefined): T | undefined {
    return v ?? undefined;
  }

  /** 人性驱动校验：非空且不在人性字典内则报错 */
  private static assertHumanDriver(humanDriver?: string): void {
    if (humanDriver && !HUMANITIES.includes(humanDriver as Humanity)) {
      throw new AppError('PRODUCT_INVALID_HUMAN_DRIVER');
    }
  }

  // ---- 商品接入（三源：system/manual/competitor/t_selection） ----
  async ingest(dto: CreateProductDto): Promise<ProductView> {
    const tenantId = TenantContext.requireTenantId();
    const source = await this.resolveSource(dto, tenantId);

    ProductService.assertHumanDriver(source.humanDriver);

    const entity = this.productRepo.create({
      tenantId,
      sourceType: dto.sourceType,
      externalProductId: dto.externalProductId ?? null,
      selectionProductId: dto.selectionProductId ?? null,
      title: source.title,
      stock: dto.stock ?? 0,
      price: source.price ?? null,
      category: source.category ?? null,
      humanDriver: source.humanDriver ?? null,
    });
    const saved = await this.productRepo.save(entity);
    await this.audit.record({
      action: 'import_product',
      module: 'product',
      resource: `product:${saved.id}`,
    });
    return toProductView(saved);
  }

  /** 三源接入：t_selection 从选品表补齐 / system 从集成适配器拉取 / manual、competitor 标题必填 */
  private async resolveSource(
    dto: CreateProductDto,
    tenantId: string,
  ): Promise<ProductSourceFields> {
    const base: ProductSourceFields = {
      title: dto.title,
      humanDriver: dto.humanDriver,
      price: dto.price,
      category: dto.category,
    };
    if (dto.sourceType === 't_selection') return this.resolveFromSelection(dto, tenantId, base);
    if (dto.sourceType === 'system') return this.resolveFromSystem(dto, base);
    // manual / competitor：标题必填
    if (!base.title) throw new AppError('PRODUCT_TITLE_REQUIRED');
    return base;
  }

  /** 选品表来源：缺省字段从选品记录补齐（null 归一为 undefined，保持 ?? 语义） */
  private async resolveFromSelection(
    dto: CreateProductDto,
    tenantId: string,
    base: ProductSourceFields,
  ): Promise<ProductSourceFields> {
    if (!dto.selectionProductId) throw new AppError('PRODUCT_SELECTION_REQUIRED');
    const sel = await this.selectionRepo.findOne({
      where: { id: dto.selectionProductId, tenantId },
    });
    if (!sel) throw new AppError('PRODUCT_SELECTION_NOT_FOUND');
    return ProductService.mergeFromSelection(base, sel);
  }

  /** 选品字段补齐：dto 显式值优先，回落选品记录（null 视同未填） */
  private static mergeFromSelection(
    base: ProductSourceFields,
    sel: SelectionFields,
  ): ProductSourceFields {
    return {
      title: base.title ?? sel.title,
      humanDriver: base.humanDriver ?? ProductService.orUndef(sel.humanDriver),
      price: base.price ?? ProductService.orUndef(sel.price),
      category: base.category ?? ProductService.orUndef(sel.category),
    };
  }

  /** 系统集成来源：从外部商品适配器拉取标题/价格 */
  private async resolveFromSystem(
    dto: CreateProductDto,
    base: ProductSourceFields,
  ): Promise<ProductSourceFields> {
    if (this.integration.isStandalone()) {
      throw new AppError('PRODUCT_SOURCE_UNSUPPORTED_IN_STANDALONE');
    }
    if (!dto.externalProductId) throw new AppError('PRODUCT_EXTERNAL_ID_REQUIRED');
    const ext = await this.integration.adapters.product.getProduct(dto.externalProductId);
    return { ...base, title: base.title ?? ext.title, price: base.price ?? ext.price };
  }

  // ---- 商品库 ----
  async list(category?: string): Promise<ProductView[]> {
    const tenantId = TenantContext.requireTenantId();
    const where: Record<string, unknown> = { tenantId };
    if (category) where.category = category;
    const rows = await this.productRepo.find({ where, order: { id: 'DESC' } });
    return rows.map(toProductView);
  }

  async getOwned(id: number): Promise<ProductEntity> {
    const tenantId = TenantContext.requireTenantId();
    const e = await this.productRepo.findOne({ where: { id, tenantId } });
    if (!e) throw new AppError('PRODUCT_NOT_FOUND');
    return e;
  }

  // ---- AI 生成内容（标题/卖点/详情/话术/种草） ----
  async generateContent(id: number, dto: GenerateContentDto): Promise<ProductContentView> {
    const product = await this.getOwned(id);
    const humanDriver = this.resolveHumanDriver(dto, product);
    const platform: ContentPlatform = dto.platform ?? 'douyin';

    const [titleAi, sellingPoint, contentText, script, xhsCopy] = await this.generateContentParts(
      product,
      humanDriver,
      platform,
    );

    const last = await this.contentRepo.findOne({
      where: { productId: id },
      order: { version: 'DESC' },
    });

    const entity = this.contentRepo.create({
      tenantId: product.tenantId,
      productId: id,
      humanDriver: humanDriver ?? null,
      titleAi,
      sellingPoint,
      content: this.parseSections(contentText),
      script,
      xhsCopy,
      version: (last?.version ?? 0) + 1,
      complianceRisk: 'none',
      status: 'draft',
    });
    const saved = await this.contentRepo.save(entity);
    await this.audit.record({
      action: 'generate_product_content',
      module: 'product',
      resource: `product:${id}`,
    });
    return toProductContentView(saved);
  }

  /** 人性驱动：dto 覆盖 > 商品既有；非法值抛错 */
  private resolveHumanDriver(dto: GenerateContentDto, product: ProductEntity): string | undefined {
    const humanDriver = dto.humanDriver ?? product.humanDriver ?? undefined;
    if (humanDriver && !HUMANITIES.includes(humanDriver as Humanity)) {
      throw new AppError('PRODUCT_INVALID_HUMAN_DRIVER');
    }
    return humanDriver;
  }

  /** 五字段 LLM 并发生成（单字段失败/空串回落规则模板，环节不缺失） */
  private generateContentParts(
    product: ProductEntity,
    humanDriver: string | undefined,
    platform: ContentPlatform,
  ): Promise<[string, string, string, string, string]> {
    const driver = humanDriver ?? '通用';
    const ctx = `商品:${product.title}; 类目:${product.category ?? '未知'}; 平台:${platform}; 人性驱动:${driver}`;
    const sectionsFallback = JSON.stringify([
      { title: '核心卖点', body: '精选品质，实用耐用，高性价比。' },
      { title: '商品介绍', body: `${product.title}，品质好物，值得入手。` },
      { title: '适用人群', body: '追求品质生活的消费者。' },
    ]);
    return Promise.all([
      this.safeGenerateText(
        `为以下商品生成吸引点击的短视频标题（≤20字，口语化）：\n${ctx}`,
        product,
        product.title.slice(0, 20),
      ),
      this.safeGenerateText(
        `基于人性驱动「${driver}」，提炼3条卖点（每条≤15字）：\n${ctx}`,
        product,
        '精选品质、实用耐用、高性价比',
      ),
      this.safeGenerateText(
        `生成商品图文详情页内容（JSON 数组，每项含 title/body，3个 section）：\n${ctx}`,
        product,
        sectionsFallback,
      ),
      this.safeGenerateText(
        `生成口播/直播话术（≤150字，口语化，含钩子与转化引导）：\n${ctx}`,
        product,
        `宝子们，今天给大家带来${product.title}，品质有保障，福利价直接带走，先到先得！`,
      ),
      this.safeGenerateText(
        `生成小红书种草文案（≤200字，emoji 自然，含痛点与种草）：\n${ctx}`,
        product,
        `${product.title}，真的绝了！品质在线，体验满分，闭眼入不踩雷，姐妹们冲！`,
      ),
    ]);
  }

  /** LLM 单字段降级：调用失败/空串时回落规则模板（对齐系统降级模式，环节不缺失） */
  private async safeGenerateText(
    prompt: string,
    product: ProductEntity,
    fallback: string,
  ): Promise<string> {
    try {
      const text = await this.skill.generateText(prompt, product.tenantId);
      return text && text.trim().length > 0 ? text.trim() : fallback;
    } catch {
      return fallback;
    }
  }

  private parseSections(text: string): Record<string, unknown> {
    try {
      const parsed: unknown = JSON.parse(text);
      if (Array.isArray(parsed)) return { sections: parsed };
      if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
    } catch {
      // 非 JSON：保留原文
    }
    return { raw: text };
  }

  async getContent(id: number): Promise<ProductContentView> {
    const product = await this.getOwned(id);
    const content = await this.contentRepo.findOne({
      where: { productId: id, tenantId: product.tenantId },
      order: { version: 'DESC' },
    });
    if (!content) throw new AppError('PRODUCT_CONTENT_NOT_FOUND');
    return toProductContentView(content);
  }

  /** 合规风险分级：无命中 none；命中高危词或命中数 ≥2 → high；否则 low */
  private static gradeRisk(hits: string[]): ComplianceRisk {
    if (!hits.length) return 'none';
    return hits.some((w) => HIGH_RISK_WORDS.includes(w)) || hits.length >= 2 ? 'high' : 'low';
  }

  /** 合规扫描文本域：商品标题 + 各生成字段（?? 缺省为空串） */
  private static complianceHaystack(product: ProductEntity, content: ProductContentEntity): string {
    return [
      product.title,
      content.titleAi ?? '',
      content.sellingPoint ?? '',
      content.script ?? '',
      content.xhsCopy ?? '',
      JSON.stringify(content.content ?? ''),
    ].join('\n');
  }

  // ---- 合规校验（P 内嵌兜底） ----
  async checkCompliance(id: number): Promise<{ risk: ComplianceRisk; hits: string[] }> {
    const product = await this.getOwned(id);
    const content = await this.contentRepo.findOne({
      where: { productId: id, tenantId: product.tenantId },
      order: { version: 'DESC' },
    });
    if (!content) throw new AppError('PRODUCT_CONTENT_NOT_FOUND');

    const haystack = ProductService.complianceHaystack(product, content);
    const hits = BANNED_WORDS.filter((w) => haystack.includes(w));
    const risk = ProductService.gradeRisk(hits);

    content.complianceRisk = risk;
    await this.contentRepo.save(content);
    await this.audit.record({
      action: 'check_product_compliance',
      module: 'product',
      resource: `product:${id}`,
    });
    return { risk, hits };
  }

  // ---- 详情页 ----
  async createDetailPage(id: number, dto: CreateDetailPageDto): Promise<ProductDetailPageView> {
    const product = await this.getOwned(id);
    const entity = this.detailRepo.create({
      tenantId: product.tenantId,
      productId: id,
      sections: dto.sections ?? null,
    });
    const saved = await this.detailRepo.save(entity);
    await this.audit.record({
      action: 'create_product_detail_page',
      module: 'product',
      resource: `product:${id}`,
    });
    return toProductDetailPageView(saved);
  }

  // ---- 库存（Y 联动：扣减/回写，standalone 单一真源在运营系统） ----
  async updateStock(id: number, dto: UpdateStockDto): Promise<ProductView> {
    const product = await this.getOwned(id);
    const next = product.stock + dto.delta;
    if (next < 0) throw new AppError('PRODUCT_STOCK_INSUFFICIENT');
    product.stock = next;
    const saved = await this.productRepo.save(product);
    await this.audit.record({
      action: 'update_product_stock',
      module: 'product',
      resource: `product:${id}`,
    });
    return toProductView(saved);
  }
}
