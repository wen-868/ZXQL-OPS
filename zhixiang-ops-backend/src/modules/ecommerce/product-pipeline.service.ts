import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppError } from '../../shared/app-error';
import { TenantContext } from '../../tenant/tenant-context';
import { SkillGateway } from '../../skill/skill.gateway';
import { ProductService } from '../r/product.service';
import { IntelService } from '../intel/intel.service';
import { SHELF_ADAPTERS } from './shelf.adapters';
import { ProductPipelineRunEntity } from './product-pipeline-run.entity';
import { ShelfService } from './shelf.service';
import { EcommercePlatform, ECOMMERCE_PLATFORMS } from './ecommerce.types';

/** 流水线环节（一个环节都不能少：图片→识图卖点→卖点搜索→自动填商品→详情页→多平台发布） */
export const PIPELINE_STEPS = ['recognize', 'search', 'fill', 'detail', 'publish'] as const;
export type PipelineStep = (typeof PIPELINE_STEPS)[number];

export interface PipelineImageInput {
  filename: string;
  path: string;
  mimetype: string;
  size: number;
}

export interface PipelineOptions {
  /** 可选：人工指定类目（缺省按规则推断） */
  category?: string;
  /** 可选：人工指定价格（缺省按规则建议） */
  price?: number;
  /** 可选：人性驱动（D 字典 7 人性：贪/懒/怕/虚荣/窥探/孤独爱/愤怒不公） */
  humanDriver?: string;
  /** 可选：发布目标平台（缺省按图片/商品线索自动选择；multipart 表单传逗号分隔字符串） */
  publishPlatforms?: EcommercePlatform[] | string;
  /** 发布后是否自动创建库存上下架规则（默认 true） */
  autoShelfRule?: boolean;
}

export interface PipelineResult {
  runId: number;
  status: string;
  productId: number | null;
  title: string | null;
  steps: Record<string, { ok: boolean; reason?: string }>;
  publishedTo: Array<{ platform: EcommercePlatform; extProductId: string; status: string }> | null;
  errorMsg?: string | null;
}

/** 规则化商品词基座（图片识图无视觉模型时的兜底线索） */
const DEFAULT_KEYWORDS = ['优选', '精选', '品质', '实用'];

/**
 * 商品全自动流水线（图片→卖点→详情页→自动填商品→多平台发布）。
 * 每环节顺序执行并落记录；识图/卖点搜索在无 LLM 环境降级为规则模板（对齐系统降级模式）。
 */
@Injectable()
export class ProductPipelineService {
  private readonly logger = new Logger(ProductPipelineService.name);

  constructor(
    @InjectRepository(ProductPipelineRunEntity)
    private readonly runRepo: Repository<ProductPipelineRunEntity>,
    private readonly products: ProductService,
    private readonly intel: IntelService,
    private readonly shelf: ShelfService,
    private readonly skill: SkillGateway,
  ) {}

  /** 一键全自动执行（在请求上下文内，tenantId 由 TenantContext 提供） */
  async runPipeline(
    image: PipelineImageInput,
    opts: PipelineOptions = {},
  ): Promise<PipelineResult> {
    const tenantId = TenantContext.requireTenantId();
    const steps: Record<string, { ok: boolean; reason?: string }> = {};
    const saved = await this.runRepo.save(
      this.runRepo.create({
        tenantId,
        imageUrl: image.path,
        fileName: image.filename,
        status: 'running',
        steps: {},
      }),
    );

    try {
      return await this.executePipeline(saved, steps, image, opts);
    } catch (e) {
      saved.status = 'failed';
      saved.steps = steps;
      saved.errorMsg = e instanceof Error ? e.message : String(e);
      return this.finish(saved);
    }
  }

  /**
   * 顺序执行五环节：任一必选环节失败即落终态返回；
   * 失败文案的默认值收敛在 halt 闭包内（不计入本函数分支）。
   */
  private async executePipeline(
    saved: ProductPipelineRunEntity,
    steps: Record<string, { ok: boolean; reason?: string }>,
    image: PipelineImageInput,
    opts: PipelineOptions,
  ): Promise<PipelineResult> {
    // 环节失败 → 落终态并收尾返回（status=failed/partial）
    const halt = (
      status: ProductPipelineRunEntity['status'],
      step: { reason?: string },
      fallback: string,
    ) => {
      saved.status = status;
      saved.steps = steps;
      saved.errorMsg = step.reason ?? fallback;
      return this.finish(saved);
    };

    // 环节1 识图卖点
    steps.recognize = await this.recognize(image);
    if (!steps.recognize.ok) return halt('failed', steps.recognize, '识图环节失败');
    const recognized = steps.recognize as unknown as { keywords: string[]; seedTitle: string };

    // 环节2 卖点搜索：情报库关键词挖掘 + 热点词增强
    steps.search = await this.searchSellingPoints(recognized.seedTitle, recognized.keywords);
    const sellingPoints = (steps.search as unknown as { points: string[] }).points;

    // 环节3 自动填商品信息
    steps.fill = await this.fillProduct(recognized, sellingPoints, opts);
    if (!steps.fill.ok) return halt('failed', steps.fill, '自动填商品环节失败');
    const productId = (steps.fill as unknown as { productId: number }).productId;
    saved.productId = productId;
    saved.title = (steps.fill as unknown as { title: string }).title;
    await this.runRepo.save(saved);

    // 环节4 商品详情页（AI 内容 → 详情页 → 合规预检）
    steps.detail = await this.makeDetailPage(productId, recognized.seedTitle, sellingPoints, opts);
    if (!steps.detail.ok) {
      return halt('partial', steps.detail, `详情页环节失败：${steps.detail.reason}`);
    }

    // 环节5 自动发布到各大平台 + 自动建库存上下架规则
    const targets = this.selectTargets(recognized.keywords, opts);
    steps.publish = await this.publishToPlatforms(productId, recognized, targets);
    ProductPipelineService.applyPublishOutcome(saved, steps, steps.publish);
    return this.finish(saved);
  }

  /** 发布环节结果落库：done/partial 终态 + publishedTo 清单 */
  private static applyPublishOutcome(
    saved: ProductPipelineRunEntity,
    steps: Record<string, { ok: boolean; reason?: string }>,
    publish: { ok: boolean; reason?: string } & Record<string, unknown>,
  ): void {
    const published = publish.published as
      Array<{ platform: EcommercePlatform; extProductId: string; status: string }> | undefined;
    saved.steps = steps;
    saved.publishedTo = published ?? [];
    if (publish.ok) {
      saved.status = 'done';
      return;
    }
    saved.status = 'partial';
    saved.errorMsg = publish.reason ?? '发布环节未完成';
  }

  private async finish(run: ProductPipelineRunEntity): Promise<PipelineResult> {
    await this.runRepo.save(run);
    return {
      runId: run.id,
      status: run.status,
      productId: run.productId ?? null,
      title: run.title ?? null,
      steps: run.steps ?? {},
      publishedTo: run.publishedTo ?? null,
      errorMsg: run.errorMsg ?? null,
    };
  }

  // ============ 环节实现 ============

  /** 环节1：识图卖点（规则化：文件名关键词 + LLM 描述兜底模板） */
  private async recognize(
    image: PipelineImageInput,
  ): Promise<{ ok: boolean; reason?: string } & Record<string, unknown>> {
    try {
      const base = image.filename.replace(/\.[^.]+$/, '');
      const keywords = this.extractKeywords(base);
      let seedTitle = `${keywords[0]}好物精选`;
      try {
        const ai = await this.skill.generateText(
          `根据图片文件线索「${base}」生成一个商品名称（≤12字，去掉扩展名，直接输出商品名，不要编号与标点）`,
        );
        const cleaned = this.cleanTitle(ai);
        if (cleaned && cleaned.length >= 2) seedTitle = cleaned.slice(0, 12);
      } catch {
        // LLM 不可用：保留规则模板
      }
      return { ok: true, keywords, seedTitle };
    } catch (e) {
      return { ok: false, reason: (e as Error).message };
    }
  }

  /** 清洗 LLM 输出：去 markdown 编号/加粗/标点，保留核心词 */
  private cleanTitle(text?: string | null): string {
    if (!text) return '';
    const words = text
      .replace(/[*#`_>-]/g, '')
      .split(/[\d.。、，,;；:：()（）"'\s]+/)
      .filter(Boolean);
    return words.join('');
  }

  /** 从文件名提取商品关键词（中文/英文数字均可） */
  private extractKeywords(name: string): string[] {
    const cleaned = name.replace(/[_-]+/g, ' ').trim();
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return DEFAULT_KEYWORDS;
    return parts.length > 4 ? parts.slice(0, 4) : parts;
  }

  /** 环节2：卖点搜索（情报库关键词挖掘 + 热点词增强） */
  private async searchSellingPoints(
    seedTitle: string,
    keywords: string[],
  ): Promise<{ ok: boolean; reason?: string } & Record<string, unknown>> {
    try {
      const mined = await this.intel.mineKeywords({
        platform: 'douyin',
        target: seedTitle.slice(0, 32),
      });
      let hot: string[] = [];
      try {
        const snap = await this.intel.getHot('douyin');
        hot = (snap.slice(0, 5) as Array<{ title?: string; keyword?: string }>).map(
          (h) => h.title ?? h.keyword ?? '',
        );
      } catch {
        // 热点不可用不影响
      }
      const points = [...new Set([...mined, ...hot, ...keywords, '品质保障', '限时优惠'])]
        .filter(Boolean)
        .slice(0, 6);
      return { ok: true, points };
    } catch (e) {
      return { ok: false, reason: (e as Error).message };
    }
  }

  /** 环节3：自动填商品信息并创建商品（识别+搜索 → 标题/类目/价格） */
  private async fillProduct(
    recognized: { keywords: string[]; seedTitle: string },
    sellingPoints: string[],
    opts: PipelineOptions,
  ): Promise<{ ok: boolean; reason?: string } & Record<string, unknown>> {
    try {
      const title = this.buildTitle(recognized.seedTitle, sellingPoints, opts);
      const category = opts.category ?? this.inferCategory(recognized.keywords, title);
      const price = opts.price ?? this.inferPrice(category);
      const view = await this.products.ingest({
        sourceType: 'manual',
        title,
        stock: 100,
        price,
        category,
        humanDriver: opts.humanDriver ?? '贪',
      });
      return { ok: true, productId: view.id, title: view.title };
    } catch (e) {
      return { ok: false, reason: (e as Error).message };
    }
  }

  private buildTitle(seedTitle: string, sellingPoints: string[], opts: PipelineOptions): string {
    const core = opts.category ? `${opts.category}精选` : seedTitle;
    const point = sellingPoints.find((p) => p && p.length <= 6) ?? '品质好物';
    return `${core}·${point}`.slice(0, 20);
  }

  private inferCategory(keywords: string[], title: string): string {
    const map: Array<[RegExp, string]> = [
      [/食|饮|零食|食品|茶|food|snack|coffee|tea|wine|drink/i, '食品'],
      [/衣|服|鞋|服饰|穿搭|cloth|shoe|fashion|dress/i, '服饰'],
      [/家居|厨|床|椅|灯|home|furniture|light|candle|aroma|香薰|蜡烛/i, '家居'],
      [/护肤|美妆|彩妆|化妆|beauty|skincare|makeup|cosmetic/i, '美妆'],
      [/数码|电子|手机|耳机|充电|digital|phone|earphone|tech/i, '数码'],
      [/玩具|儿童|母婴|baby|toy|kids/i, '母婴'],
    ];
    for (const [re, cat] of map) {
      if (re.test(title) || keywords.some((k) => re.test(k))) return cat;
    }
    return '其他';
  }

  private inferPrice(category: string): number {
    const base: Record<string, number> = {
      食品: 49,
      服饰: 129,
      家居: 99,
      美妆: 139,
      数码: 299,
      母婴: 89,
    };
    return base[category] ?? 99;
  }

  /** 环节4：制作商品详情页（AI 内容 → 详情页 → 合规预检；LLM 不可用时降级规则模板，环节不缺失） */
  private async makeDetailPage(
    productId: number,
    seedTitle: string,
    sellingPoints: string[],
    opts: PipelineOptions,
  ): Promise<{ ok: boolean; reason?: string } & Record<string, unknown>> {
    try {
      const { sections, downgraded } = await this.buildDetailSections(
        productId,
        seedTitle,
        sellingPoints,
        opts,
      );
      await this.products.createDetailPage(productId, { sections });
      const compliance = await this.products.checkCompliance(productId);
      return { ok: true, downgraded, risk: compliance?.risk ?? 'none' };
    } catch (e) {
      return { ok: false, reason: (e as Error).message };
    }
  }

  /**
   * 详情页 sections 生成：AI 内容优先，LLM 不可用则降级规则模板（对齐系统降级模式）。
   * 降级判定收敛在本方法内，环节本身不缺失。
   */
  private async buildDetailSections(
    productId: number,
    seedTitle: string,
    sellingPoints: string[],
    opts: PipelineOptions,
  ): Promise<{ sections: Array<Record<string, unknown>>; downgraded: boolean }> {
    try {
      const content = await this.products.generateContent(productId, {
        humanDriver: opts.humanDriver ?? '贪',
        platform: 'douyin',
      });
      const sections = Array.isArray(content.content?.sections)
        ? (content.content.sections as Array<Record<string, unknown>>)
        : [];
      if (sections.length > 0) return { sections, downgraded: false };
      return { sections: [{ title: '卖点', body: content.sellingPoint }], downgraded: false };
    } catch {
      // LLM Provider 不可用：降级规则模板
      return {
        sections: [
          { title: '核心卖点', body: sellingPoints.slice(0, 3).join('、') },
          { title: '商品介绍', body: `${seedTitle}，精选品质好物，值得入手。` },
          { title: '适用人群', body: '追求品质生活的消费者。' },
        ],
        downgraded: true,
      };
    }
  }

  /** 环节5：发布到各大平台（创建 Listing → 自动建上下架规则） */
  private async publishToPlatforms(
    productId: number,
    recognized: { keywords: string[] },
    targets: EcommercePlatform[],
  ): Promise<{ ok: boolean; reason?: string } & Record<string, unknown>> {
    const product = await this.products.getOwned(productId);
    const published: Array<{ platform: EcommercePlatform; extProductId: string; status: string }> =
      [];
    const failed: string[] = [];
    for (const platform of targets) {
      const adapter = SHELF_ADAPTERS[platform];
      if (!adapter) {
        failed.push(`${platform}:适配器未注册`);
        continue;
      }
      try {
        const res = await adapter.publishProduct({
          title: product.title,
          category: product.category,
          price: product.price,
          stock: product.stock,
          imageUrl: `uploads/${productId}.jpg`,
          tenantId: product.tenantId,
          platform,
        });
        // 平台映射 + 自动上下架规则 单事务原子落库（任一失败整体回滚）
        await this.shelf.recordPublicationWithRule(product, platform, res, {
          strategy: 'inventory',
          action: 'auto',
          params: { threshold: 0, autoRestore: true },
          enabled: true,
        });
        published.push({
          platform,
          extProductId: res.extProductId,
          status: res.status,
        });
      } catch (e) {
        failed.push(`${platform}:${(e as Error).message}`);
      }
    }
    if (published.length === 0) {
      return { ok: false, reason: `所有平台发布失败：${failed.join('；')}` };
    }
    return { ok: true, published, failed };
  }

  /** 目标平台选择：显式指定优先；否则按类目推断国内优先 */
  private selectTargets(keywords: string[], opts: PipelineOptions): EcommercePlatform[] {
    const raw = opts.publishPlatforms;
    if (raw && raw.length) {
      const list = (Array.isArray(raw) ? raw : String(raw).split(','))
        .map((p) => String(p).trim())
        .filter(Boolean);
      if (list.length)
        return list.filter((p) =>
          ECOMMERCE_PLATFORMS.includes(p as EcommercePlatform),
        ) as EcommercePlatform[];
    }
    const hits = keywords.map((k) => k.toLowerCase());
    const overseas = hits.some((k) => /amazon|shop|tiktok|export|global|海外/.test(k));
    const base: EcommercePlatform[] = overseas
      ? ['tiktok-shop', 'amazon', 'shopify']
      : ['douyin-shop', 'taobao', 'pdd'];
    return base.filter((p) => ECOMMERCE_PLATFORMS.includes(p));
  }

  /** 流水线历史（最近 50 条） */
  async listRuns(): Promise<ProductPipelineRunEntity[]> {
    const tenantId = TenantContext.requireTenantId();
    return this.runRepo.find({ where: { tenantId }, order: { id: 'DESC' }, take: 50 });
  }

  async getRun(id: number): Promise<ProductPipelineRunEntity> {
    const tenantId = TenantContext.requireTenantId();
    const run = await this.runRepo.findOne({ where: { id, tenantId } });
    if (!run) throw new AppError('PIPELINE_RUN_NOT_FOUND');
    return run;
  }
}
