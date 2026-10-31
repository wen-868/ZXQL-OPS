/**
 * 迁移文件名白名单纯策略（OPS-SECURITY-MIGRATE-WHITELIST-01）。
 *
 * 仅允许 `NNN_小写标识.sql`（3 位序号 + 小写/数字/下划线），阻断：
 * 路径穿越（../、..\、绝对路径、路径分隔符）、大写/非法字符、
 * 非 SQL 后缀、少/多位数序号。
 *
 * 本文件是白名单正则的唯一出处（db/migrate.ts 为唯一消费方，不出现第二份正则）。
 */
export const MIGRATION_NAME_PATTERN = /^\d{3}_[a-z0-9_]+\.sql$/;

/** 迁移文件名白名单：合法返回 true，否则拒绝 */
export function isAllowedMigrationName(name: unknown): boolean {
  if (typeof name !== 'string' || name.length === 0 || name.length > 255) return false;
  // 意图显式化：任何路径分隔符/穿越片段直接拒绝（正则本身已排除，此处防未来放宽时回归）
  if (name.includes('/') || name.includes('\\') || name.includes('..')) return false;
  return MIGRATION_NAME_PATTERN.test(name);
}

/** 白名单过滤 + 按文件名升序排序（001, 002, ...） */
export function filterAndSortMigrationNames(names: readonly string[]): string[] {
  return names.filter((n) => isAllowedMigrationName(n)).sort();
}
