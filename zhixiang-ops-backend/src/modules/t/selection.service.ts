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
    let items = dto.products;

    if (!items || items.length === 0) {
      if (dto.ids && dto.ids.length > 0) {
        if (this.integration.isStandalone()) {
          throw new AppError(
            'SELECTION_IMPORT_MODE_UNSUPPORTED',
            '当前为独立模式，无法经平台 API 批量拉取；请直接传入 products 列表',
          );
        }
        const dtos = await this.integration.adapters.product.getProductsByIds(dto.ids);
        items = dtos.map((p) => ({
          externalProductId: p.id,
          title: p.title,
          price: p.price,
          platform: dto.platform,
        }));
      } else {
        throw new AppError('SELECTION_IMPORT_EMPTY', 'import 需提供 products 或 ids');
      }
    }

    const entities = items.map((it) => {
      if (it.humanDriver && !isHumanity(it.humanDriver)) {
        throw new AppError('SELECTION_INVALID_HUMAN_DRIVER', `非法人性标签: ${it.humanDriver}`);
      }
      return this.productRepo.create({
        tenantId,
        source: dto.source,
        platform: it.platform ?? dto.platform ?? null,
        externalProductId: it.externalProductId ?? null,
        title: it.title,
        commissionRate: it.commissionRate ?? 0,
        reputationScore: it.reputationScore ?? null,
        sales30d: it.sales30d ?? 0,
        price: it.price ?? null,
        category: it.category ?? null,
        humanDriver: it.humanDriver ?? null,
        metrics: it.metrics ?? null,
        collectedAt: new Date(),
      });
    });

    const saved = await this.productRepo.save(entities);
    await this.audit.record({
      action: 'import_selection',
      module: 'selection',
      resource: `count:${saved.length}`,
    });
    return saved.map((e) => this.toProductView(e));
  }

  /** 选品库筛选（佣金%/口碑分/销量/类目/人性/关键词），按销量降序分页 */
  async querySelection(filter: SelectionFilterDto): Promise<PaginatedResult<SelectionProductView>> {
    const tenantId = TenantContext.requireTenantId();
    const qb = this.productRepo
      .createQueryBuilder('p')
      .where('p.tenantId = :tenantId', { tenantId });

    if (filter.commissionRateMin != null) {
      qb.andWhere('p.commissionRate >= :c', { c: filter.commissionRateMin });
    }
    if (filter.reputationMin != null) {
      qb.andWhere('p.reputationScore >= :r', { r: filter.reputationMin });
    }
    if (filter.salesMin != null) {
      qb.andWhere('p.sales30d >= :s', { s: filter.salesMin });
    }
    if (filter.category) {
      qb.andWhere('p.category = :cat', { cat: filter.category });
    }
    if (filter.humanDriver) {
      qb.andWhere('p.humanDriver = :hd', { hd: filter.humanDriver });
    }
    if (filter.keyword) {
      qb.andWhere('p.title LIKE :kw', { kw: `%${filter.keyword}%` });
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
      platform: e.platform ?? null,
      externalProductId: e.externalProductId ?? null,
      title: e.title,
      commissionRate: Number(e.commissionRate),
      reputationScore: e.reputationScore != null ? Number(e.reputationScore) : null,
      sales30d: Number(e.sales30d),
      price: e.price != null ? Number(e.price) : null,
      category: e.category ?? null,
      humanDriver: e.humanDriver ?? null,
      metrics: (e.metrics as Record<string, unknown>) ?? null,
      collectedAt: e.collectedAt ?? null,
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
