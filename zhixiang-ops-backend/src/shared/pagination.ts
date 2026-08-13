import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * 分页标准（对齐规划与管理系统的 {list,total,page,pageSize} 结构）。
 * 所有列表接口统一使用，避免各模块各自实现分页参数。
 */

/** 分页查询 DTO：控制器入参直接 extends 或组合使用 */
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number = 20;
}

/** 标准化分页结果（即信封 data 的内容） */
export interface PaginatedResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** 组装分页结果；page/pageSize 缺省给默认值，保证结构稳定 */
export function buildPage<T>(
  list: T[],
  total: number,
  page = 1,
  pageSize = 20,
): PaginatedResult<T> {
  return { list, total, page, pageSize };
}

/** 由 page/pageSize 计算 SQL 的 offset/limit，防越界 */
export function pageOffset(page = 1, pageSize = 20): { skip: number; take: number } {
  const safePage = Math.max(1, Math.floor(page));
  const safeSize = Math.min(200, Math.max(1, Math.floor(pageSize)));
  return { skip: (safePage - 1) * safeSize, take: safeSize };
}
