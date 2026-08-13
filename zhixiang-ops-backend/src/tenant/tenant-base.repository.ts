import { FindManyOptions, FindOneOptions, FindOptionsWhere, Repository } from 'typeorm';
import { BaseEntity } from '../database/base.entity';
import { TenantContext } from './tenant-context';

/**
 * 租户过滤注入器（规划 §13 读期兜底）。
 *
 * 约定：
 * - 上下文有 tenantId 时，向 where 自动注入 { tenantId }，防止业务层漏写导致跨租户泄漏；
 * - 业务上确实需要跨租户/全量查询时，显式写 `where: { tenantId: null }` 跳过注入（注入器会把
 *   该 key 剔除后原样返回）；
 * - 非对象 where（字符串/复杂结构）不注入，保持原行为。
 */
export function applyTenantFilter<T>(
  where: FindOptionsWhere<T> | FindOptionsWhere<T>[] | undefined,
  tenantId: string | undefined,
): FindOptionsWhere<T> | FindOptionsWhere<T>[] | undefined {
  if (!tenantId) return where;
  const inject = (w: FindOptionsWhere<T>): FindOptionsWhere<T> => {
    if (!w || typeof w !== 'object') return w;
    if ('tenantId' in w && (w as Record<string, unknown>).tenantId === null) {
      const { tenantId: _skip, ...rest } = w as Record<string, unknown>;
      return rest as FindOptionsWhere<T>;
    }
    return { ...w, tenantId };
  };
  if (Array.isArray(where)) return where.map(inject);
  return where ? inject(where) : undefined;
}

/**
 * 租户感知仓库基类：读期自动追加 tenantId 的 Repository 子类。
 * TypeORM 0.3 自定义仓库约定（target, manager, queryRunner）构造签名，
 * 模块内以 TypeOrmModule.forFeature([Entity, TenantBaseRepository]) 注册后
 * 用 @InjectRepository(TenantBaseRepository) 注入。
 *
 * 覆盖所有「按条件读」的入口：find/findOne/findBy/findOneBy/count/exists 及分页对。
 * 写期隔离仍由 TenantSubscriber + BaseEntity.beforeInsert 强约束，本基类不改变写行为。
 */
export class TenantBaseRepository<T extends BaseEntity> extends Repository<T> {
  find(options?: FindManyOptions<T>): Promise<T[]> {
    return super.find({
      ...options,
      where: applyTenantFilter(options?.where, TenantContext.getTenantId()),
    });
  }

  findBy(where: FindOptionsWhere<T>[] | FindOptionsWhere<T>): Promise<T[]> {
    return super.findBy(
      applyTenantFilter(where, TenantContext.getTenantId()) as FindOptionsWhere<T>[],
    );
  }

  findAndCount(options?: FindManyOptions<T>): Promise<[T[], number]> {
    return super.findAndCount({
      ...options,
      where: applyTenantFilter(options?.where, TenantContext.getTenantId()),
    });
  }

  findAndCountBy(where: FindOptionsWhere<T>[] | FindOptionsWhere<T>): Promise<[T[], number]> {
    return super.findAndCountBy(
      applyTenantFilter(where, TenantContext.getTenantId()) as FindOptionsWhere<T>[],
    );
  }

  findOne(options: FindOneOptions<T>): Promise<T | null> {
    return super.findOne({
      ...options,
      where: applyTenantFilter(options.where, TenantContext.getTenantId()),
    });
  }

  findOneBy(where: FindOptionsWhere<T>[] | FindOptionsWhere<T>): Promise<T | null> {
    return super.findOneBy(
      applyTenantFilter(where, TenantContext.getTenantId()) as FindOptionsWhere<T>[],
    );
  }

  count(options?: FindManyOptions<T>): Promise<number> {
    return super.count({
      ...options,
      where: applyTenantFilter(options?.where, TenantContext.getTenantId()),
    });
  }

  countBy(where: FindOptionsWhere<T>[] | FindOptionsWhere<T>): Promise<number> {
    return super.countBy(
      applyTenantFilter(where, TenantContext.getTenantId()) as FindOptionsWhere<T>[],
    );
  }

  exists(options?: FindManyOptions<T>): Promise<boolean> {
    return super.exists({
      ...options,
      where: applyTenantFilter(options?.where, TenantContext.getTenantId()),
    });
  }

  existsBy(where: FindOptionsWhere<T>[] | FindOptionsWhere<T>): Promise<boolean> {
    return super.existsBy(
      applyTenantFilter(where, TenantContext.getTenantId()) as FindOptionsWhere<T>[],
    );
  }
}
