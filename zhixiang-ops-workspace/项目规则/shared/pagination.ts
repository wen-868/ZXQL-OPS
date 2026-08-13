/**
 * 分页工具函数
 * 统一处理分页参数校验、偏移量计算、返回格式封装
 */

/** 分页参数类型 */
export interface PaginationParams {
  page: number;
  pageSize: number;
}

/** 分页结果类型 */
export interface PaginatedResult<T> {
  total: number;
  page: number;
  pageSize: number;
  records: T[];
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/** 默认分页大小 */
const DEFAULT_PAGE_SIZE = 20;

/** 最大分页大小 */
const MAX_PAGE_SIZE = 100;

/**
 * 标准化分页参数
 * @param params - 原始分页参数
 * @returns 标准化后的分页参数
 */
export function normalizePagination(params: { page?: number; pageSize?: number }): PaginationParams {
  let page = Number(params.page) || 1;
  let pageSize = Number(params.pageSize) || DEFAULT_PAGE_SIZE;

  // 页码最小为 1
  if (page < 1) page = 1;

  // 分页大小限制在合理范围
  if (pageSize < 1) pageSize = DEFAULT_PAGE_SIZE;
  if (pageSize > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE;

  return { page, pageSize };
}

/**
 * 计算分页偏移量
 * @param page - 当前页码（从 1 开始）
 * @param pageSize - 每页大小
 * @returns 偏移量
 */
export function calculateOffset(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}

/**
 * 封装分页结果
 * @param records - 当前页数据
 * @param total - 总记录数
 * @param page - 当前页码
 * @param pageSize - 每页大小
 * @returns 分页结果对象
 */
export function paginate<T>(records: T[], total: number, page: number, pageSize: number): PaginatedResult<T> {
  const totalPages = Math.ceil(total / pageSize);

  return {
    total,
    page,
    pageSize,
    records,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

/**
 * 分页查询模板函数
 * @param queryFn - 查询记录的函数，返回记录数组
 * @param countFn - 查询总数的函数，返回总数
 * @param page - 当前页码
 * @param pageSize - 每页大小
 * @returns 分页结果对象
 */
export async function paginatedQuery<T>(
  queryFn: () => Promise<T[]>,
  countFn: () => Promise<number>,
  page: number,
  pageSize: number
): Promise<PaginatedResult<T>> {
  const normalized = normalizePagination({ page, pageSize });
  
  // 并行执行查询和计数
  const [records, total] = await Promise.all([queryFn(), countFn()]);

  return paginate(records, total, normalized.page, normalized.pageSize);
}

/**
 * 带关键词过滤的分页查询模板函数
 * @param queryFn - 查询记录的函数，返回记录数组
 * @param countFn - 查询总数的函数，返回总数
 * @param page - 当前页码
 * @param pageSize - 每页大小
 * @param keyword - 搜索关键词（可选）
 * @returns 分页结果对象
 */
export async function paginatedSearchQuery<T>(
  queryFn: () => Promise<T[]>,
  countFn: () => Promise<number>,
  page: number,
  pageSize: number,
  keyword?: string
): Promise<PaginatedResult<T>> {
  const normalized = normalizePagination({ page, pageSize });
  
  // 注意：keyword 参数保留用于向后兼容，实际 LIKE 处理需要在 queryFn 和 countFn 中完成

  const [records, total] = await Promise.all([queryFn(), countFn()]);

  return paginate(records, total, normalized.page, normalized.pageSize);
}