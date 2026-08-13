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

  // ---- 商品接入（三源：system/manual/competitor/t_selection） ----
  async ingest(dto: CreateProductDto): Promise<ProductView> {
    const tenantId = TenantContext.requireTenantId();
    let title = dto.title;
    let humanDriver = dto.humanDriver;
    let price = dto.price;
    let category = dto.category;
    const stock = dto.stock ?? 0;

    if (dto.sourceType === 't_selection') {
      if (!dto.selectionProductId) throw new AppError('PRODUCT_SELECTION_REQUIRED');
      const sel = await this.selectionRepo.findOne({
        where: { id: dto.selectionProductId, tenantId },
      });
      if (!sel) throw new AppError('PRODUCT_SELECTION_NOT_FOUND');
      title = title ?? sel.title;
      humanDriver = humanDriver ?? sel.humanDriver ?? undefined;
      price = price ?? sel.price ?? undefined;
      category = category ?? sel.category ?? undefined;
    } else if (dto.sourceType === 'system') {
      if (this.integration.isStandalone()) {
        throw new AppError('PRODUCT_SOURCE_UNSUPPORTED_IN_STANDALONE');
      }
      if (!dto.externalProductId) throw new AppError('PRODUCT_EXTERNAL_ID_REQUIRED');
      const ext = await this.integration.adapters.product.getProduct(dto.externalProductId);
      title = title ?? ext.title;
      price = price ?? ext.price;
    } else {
      // manual / competitor：标题必填
      if (!title) throw new AppError('PRODUCT_TITLE_REQUIRED');
    }

    if (humanDriver && !HUMANITIES.includes(humanDriver as Humanity)) {
      throw new AppError('PRODUCT_INVALID_HUMAN_DRIVER');
    }

    const entity = this.productRepo.create({
      tenantId,
      sourceType: dto.sourceType,
      externalProductId: dto.externalProductId ?? null,
      selectionProductId: dto.selectionProductId ?? null,
      title: title,
      stock,
      price: price ?? null,
      category: category ?? null,
      humanDriver: humanDriver ?? null,
    });
    const saved = await this.productRepo.save(entity);
    await this.audit.record({
      action: 'import_product',
      module: 'product',
      resource: `product:${saved.id}`,
    });
    return toProductView(saved);
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
    const humanDriver = dto.humanDriver ?? product.humanDriver ?? undefined;
    if (humanDriver && !HUMANITIES.includes(humanDriver as Humanity)) {
      throw new AppError('PRODUCT_INVALID_HUMAN_DRIVER');
    }
    const platform: ContentPlatform = dto.platform ?? 'douyin';

    const ctx = `商品:${product.title}; 类目:${product.category ?? '未知'}; 平台:${platform}; 人性驱动:${humanDriver ?? '通用'}`;
    const [titleAi, sellingPoint, contentText, script, xhsCopy] = await Promise.all([
      this.skill.generateText(
        `为以下商品生成吸引点击的短视频标题（≤20字，口语化）：\n${ctx}`,
        product.tenantId,
      ),
      this.skill.generateText(
        `基于人性驱动「${humanDriver ?? '通用'}」，提炼3条卖点（每条≤15字）：\n${ctx}`,
        product.tenantId,
      ),
      this.skill.generateText(
        `生成商品图文详情页内容（JSON 数组，每项含 title/body，3个 section）：\n${ctx}`,
        product.tenantId,
      ),
      this.skill.generateText(
        `生成口播/直播话术（≤150字，口语化，含钩子与转化引导）：\n${ctx}`,
        product.tenantId,
      ),
      this.skill.generateText(
        `生成小红书种草文案（≤200字，emoji 自然，含痛点与种草）：\n${ctx}`,
        product.tenantId,
      ),
    ]);

    const last = await this.contentRepo.findOne({
      where: { productId: id },
      order: { version: 'DESC' },
    });
    const version = (last?.version ?? 0) + 1;

    const entity = this.contentRepo.create({
      tenantId: product.tenantId,
      productId: id,
      humanDriver: humanDriver ?? null,
      titleAi,
      sellingPoint,
      content: this.parseSections(contentText),
      script,
      xhsCopy,
      version,
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

  // ---- 合规校验（P 内嵌兜底） ----
  async checkCompliance(id: number): Promise<{ risk: ComplianceRisk; hits: string[] }> {
    const product = await this.getOwned(id);
    const content = await this.contentRepo.findOne({
      where: { productId: id, tenantId: product.tenantId },
      order: { version: 'DESC' },
    });
    if (!content) throw new AppError('PRODUCT_CONTENT_NOT_FOUND');

    const haystack = [
      product.title,
      content.titleAi ?? '',
      content.sellingPoint ?? '',
      content.script ?? '',
      content.xhsCopy ?? '',
      JSON.stringify(content.content ?? ''),
    ].join('\n');

    const hits = BANNED_WORDS.filter((w) => haystack.includes(w));
    let risk: ComplianceRisk = 'none';
    if (hits.length > 0) {
      const hasHigh = hits.some((w) => HIGH_RISK_WORDS.includes(w));
      risk = hasHigh || hits.length >= 2 ? 'high' : 'low';
    }
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
