import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { TenantContext } from '../../tenant/tenant-context';
import { buildPage, PaginatedResult } from '../../shared/pagination';
import { AppError } from '../../shared/app-error';
import { isHumanity } from '../../core/humanity-emotion';
import { IntegrationService } from '../../integration/integration.service';
import { AuditService } from '../../modules/n/audit.service';
import { SelectionProductEntity } from './selection-product.entity';
import { SelectionListEntity } from './selection-list.entity';
import { BlueOceanItem, HotItem, SelectionListView, SelectionProductView } from './t.types';
import { ImportSelectionDto } from './dto/import-selection.dto';
import { CreateSelectionListDto } from './dto/create-selection-list.dto';
import { SelectionFilterDto } from './dto/selection-filter.dto';

/**
 * 选品中心服务（规划 T 选品中心）。
 * - 选品库导入（本地录入 / 适配层批量拉取）、筛选（佣金%/口碑分/销量）
 * - 榜单（飙升/黑马预警）、蓝海词挖掘
 * - 选品清单管理；human_driver 映射 D 字典（选品→内容 R 联动）
 * - 关键写操作落审计（AuditService，tenantId 由 TenantContext 透传）
 */
@Injectable()
export class SelectionService {
  constructor(
    @InjectRepository(SelectionProductEntity)
    private readonly productRepo: Repository<SelectionProductEntity>,
    @InjectRepository(SelectionListEntity)
    private readonly listRepo: Repository<SelectionListEntity>,
    private readonly integration: IntegrationService,
    private readonly audit: AuditService,
  ) {}

  /** 导入选品：products 本地录入（优先）；ids 需 connected 模式经适配层拉取 */
  async importSelection(dto: ImportSelectionDto): Promise<SelectionProductView[]> {
    const tenantId = TenantContext.requireTenantId();
    const items = await this.resolveImportItems(dto);

    const entities = items.map((it) => this.buildProductRow(tenantId, dto, it));

    const saved = await this.productRepo.save(entities);
    await this.audit.record({
      action: 'import_selection',
      module: 'selection',
      resource: `count:${saved.length}`,
    });
    return saved.map((e) => this.toProductView(e));
  }

  /** 解析导入条目：products 优先；缺省时经适配层按 ids 拉取（standalone 拒绝） */
  private async resolveImportItems(
    dto: ImportSelectionDto,
  ): Promise<NonNullable<ImportSelectionDto['products']>> {
    if (dto.products && dto.products.length > 0) return dto.products;
    if (!dto.ids || dto.ids.length === 0) {
      throw new AppError('SELECTION_IMPORT_EMPTY', 'import 需提供 products 或 ids');
    }
    if (this.integration.isStandalone()) {
      throw new AppError(
        'SELECTION_IMPORT_MODE_UNSUPPORTED',
        '当前为独立模式，无法经平台 API 批量拉取；请直接传入 products 列表',
      );
    }
    const dtos = await this.integration.adapters.product.getProductsByIds(dto.ids);
    return dtos.map((p) => ({
      externalProductId: p.id,
      title: p.title,
      price: p.price,
      platform: dto.platform,
    }));
  }

  /** 十进制列（TypeORM 返回 string）→ number；null/undefined 透传 null */
  private static numOrNull(v: unknown): number | null {
    return v == null ? null : Number(v);
  }

  /** 可空字段归一：undefined → null（视图映射统一走此函数，避免 ?? 散落计数） */
  private static orNull<T>(v: T | null | undefined): T | null {
    return v ?? null;
  }

  /** 过滤 null/undefined（展开覆盖时只保留"显式提供"的字段） */
  private static compact<T extends object>(obj: T): Partial<T> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined && v !== null) out[k] = v;
    }
    return out as Partial<T>;
  }

  /** 选品实体构造（校验人性标签；默认值 + 显式覆盖，等价原 ?? 链） */
  private buildProductRow(
    tenantId: string,
    dto: ImportSelectionDto,
    it: NonNullable<ImportSelectionDto['products']>[number],
  ): SelectionProductEntity {
    if (it.humanDriver && !isHumanity(it.humanDriver)) {
      throw new AppError('SELECTION_INVALID_HUMAN_DRIVER', `非法人性标签: ${it.humanDriver}`);
    }
    return this.productRepo.create({
      tenantId,
      source: dto.source,
      platform: dto.platform ?? null,
      externalProductId: null,
      title: it.title,
      commissionRate: 0,
      reputationScore: null,
      sales30d: 0,
      price: null,
      category: null,
      humanDriver: null,
      metrics: null,
      collectedAt: new Date(),
      ...SelectionService.compact({
        platform: it.platform,
        externalProductId: it.externalProductId,
        commissionRate: it.commissionRate,
        reputationScore: it.reputationScore,
        sales30d: it.sales30d,
        price: it.price,
        category: it.category,
        humanDriver: it.humanDriver,
        metrics: it.metrics,
      }),
    });
  }

  /** 选品库筛选（佣金%/口碑分/销量/类目/人性/关键词），按销量降序分页 */
  async querySelection(filter: SelectionFilterDto): Promise<PaginatedResult<SelectionProductView>> {
    const tenantId = TenantContext.requireTenantId();
    const qb = this.productRepo
      .createQueryBuilder('p')
      .where('p.tenantId = :tenantId', { tenantId });

    // 条件表：字段 → (列名, SQL 片段)；空值一律跳过
    const conditions: Array<[string | number | null | undefined, string, string]> = [
      [filter.commissionRateMin, 'p.commissionRate >= :c', 'c'],
      [filter.reputationMin, 'p.reputationScore >= :r', 'r'],
      [filter.salesMin, 'p.sales30d >= :s', 's'],
      [filter.category, 'p.category = :cat', 'cat'],
      [filter.humanDriver, 'p.humanDriver = :hd', 'hd'],
      [filter.keyword, 'p.title LIKE :kw', 'kw'],
    ];
    for (const [value, clause, param] of conditions) {
      if (value === null || value === undefined || value === '') continue;
      const bind = param === 'kw' ? `%${String(value)}%` : value;
      qb.andWhere(clause, { [param]: bind });
    }
    qb.orderBy('p.sales30d', 'DESC');

    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 20;
    const [list, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return buildPage(
      list.map((e) => this.toProductView(e)),
      total,
      page,
      pageSize,
    );
  }

  /** 榜单：飙升榜（销量 top）/ 黑马预警（高口碑低销量 top） */
  async getHot(): Promise<{ surging: HotItem[]; darkHorse: HotItem[] }> {
    const tenantId = TenantContext.requireTenantId();
    const surging = await this.productRepo
      .createQueryBuilder('p')
      .where('p.tenantId = :tenantId', { tenantId })
      .orderBy('p.sales30d', 'DESC')
      .limit(20)
      .getMany();
    const darkHorse = await this.productRepo
      .createQueryBuilder('p')
      .where('p.tenantId = :tenantId AND p.reputationScore >= 4.6', { tenantId })
      .orderBy('p.sales30d', 'ASC')
      .limit(20)
      .getMany();
    return {
      surging: surging.map((e) => this.toHot(e)),
      darkHorse: darkHorse.map((e) => this.toHot(e)),
    };
  }

  /** 蓝海词挖掘：按类目聚合，找高佣金低销量的潜力类目 */
  async getBlueOcean(): Promise<BlueOceanItem[]> {
    const tenantId = TenantContext.requireTenantId();
    const all = await this.productRepo.find({ where: { tenantId } });
    const byCat = new Map<string, SelectionProductEntity[]>();
    for (const p of all) {
      if (!p.category) continue;
      const arr = byCat.get(p.category) ?? [];
      arr.push(p);
      byCat.set(p.category, arr);
    }
    const result: BlueOceanItem[] = [];
    for (const [category, ps] of byCat) {
      const avgCommissionRate = ps.reduce((a, p) => a + Number(p.commissionRate), 0) / ps.length;
      const avgSales30d = ps.reduce((a, p) => a + Number(p.sales30d), 0) / ps.length;
      const score = (avgCommissionRate * 100) / (avgSales30d + 1);
      result.push({
        category,
        avgCommissionRate: Number(avgCommissionRate.toFixed(2)),
        avgSales30d: Math.round(avgSales30d),
        score: Number(score.toFixed(2)),
      });
    }
    return result.sort((a, b) => b.score - a.score);
  }

  /** 新建选品清单（校验 items 引用的选品均属本租户） */
  async createList(dto: CreateSelectionListDto): Promise<SelectionListView> {
    const tenantId = TenantContext.requireTenantId();
    if (dto.items && dto.items.length > 0) {
      const cnt = await this.productRepo.count({ where: { tenantId, id: In(dto.items) } });
      if (cnt !== dto.items.length) {
        throw new AppError('SELECTION_PRODUCT_NOT_FOUND', '清单引用了不存在的选品');
      }
    }
    const e = this.listRepo.create({ tenantId, name: dto.name, items: dto.items ?? [] });
    const saved = await this.listRepo.save(e);
    await this.audit.record({
      action: 'create_selection_list',
      module: 'selection',
      resource: `id:${saved.id}`,
    });
    return this.toListView(saved);
  }

  /** 选品清单列表 */
  async getLists(): Promise<SelectionListView[]> {
    const tenantId = TenantContext.requireTenantId();
    const list = await this.listRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
    return list.map((e) => this.toListView(e));
  }

  /** 选品清单详情（展开 items 为选品视图） */
  async getList(id: number): Promise<SelectionListView & { products: SelectionProductView[] }> {
    const tenantId = TenantContext.requireTenantId();
    const e = await this.listRepo.findOne({ where: { id, tenantId } });
    if (!e) throw new AppError('SELECTION_LIST_NOT_FOUND');
    const products =
      e.items && e.items.length > 0
        ? await this.productRepo.find({ where: { tenantId, id: In(e.items) } })
        : [];
    return { ...this.toListView(e), products: products.map((p) => this.toProductView(p)) };
  }

  /** 删除选品清单（软删） */
  async removeList(id: number): Promise<{ id: number }> {
    const tenantId = TenantContext.requireTenantId();
    const e = await this.listRepo.findOne({ where: { id, tenantId } });
    if (!e) throw new AppError('SELECTION_LIST_NOT_FOUND');
    await this.listRepo.softRemove(e);
    await this.audit.record({
      action: 'delete_selection_list',
      module: 'selection',
      resource: `id:${id}`,
    });
    return { id };
  }

  private toProductView(e: SelectionProductEntity): SelectionProductView {
    return {
      id: e.id,
      source: e.source,
      platform: SelectionService.orNull(e.platform),
      externalProductId: SelectionService.orNull(e.externalProductId),
      title: e.title,
      commissionRate: Number(e.commissionRate),
      reputationScore: SelectionService.numOrNull(e.reputationScore),
      sales30d: Number(e.sales30d),
      price: SelectionService.numOrNull(e.price),
      category: SelectionService.orNull(e.category),
      humanDriver: SelectionService.orNull(e.humanDriver),
      metrics: SelectionService.orNull(e.metrics),
      collectedAt: SelectionService.orNull(e.collectedAt),
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    };
  }

  private toHot(e: SelectionProductEntity): HotItem {
    return {
      id: e.id,
      title: e.title,
      commissionRate: Number(e.commissionRate),
      reputationScore: e.reputationScore != null ? Number(e.reputationScore) : null,
      sales30d: Number(e.sales30d),
      humanDriver: e.humanDriver ?? null,
    };
  }

  private toListView(e: SelectionListEntity): SelectionListView {
    const items = (e.items as number[]) ?? [];
    return {
      id: e.id,
      name: e.name,
      items,
      itemCount: items.length,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    };
  }
}
