/**
 * 启动期 SQL 迁移执行（与 db/migrate.ts 同源逻辑：__migrations 追踪 + 现有库基线化）。
 *
 * 用途：本地打包运行时，应用启动即建表，无需人工执行迁移脚本，也不再依赖 synchronize。
 * 顺序：ensureEmbeddedMysql → runSqlMigrations → NestFactory.create（TypeORM 建连前表已就绪）。
 */
import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import mysql from 'mysql2/promise';

export interface SqlMigrationConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  /** 迁移目录（缺省按 __dirname 推导，兼容 dist 与源码运行） */
  migrationsDir?: string;
  log?: (msg: string) => void;
}

export interface SqlMigrationDeps {
  /** 建立连接（测试可注入 mock） */
  connect: (cfg: SqlMigrationConfig) => Promise<mysql.Connection>;
  readdir: (dir: string) => Promise<string[]>;
  readFile: (p: string) => Promise<string>;
  exists: (p: string) => boolean;
}

export interface SqlMigrationResult {
  applied: string[];
  skipped: number;
  baselined: boolean;
}

/** 解析迁移目录：dist/src/database → dist/db/migrations；src/database → <root>/db/migrations */
export function resolveMigrationsDir(explicit?: string, dirname = __dirname): string {
  if (explicit) return explicit;
  const candidates = [
    join(dirname, '..', '..', 'db', 'migrations'), // dist 与源码均适用
    join(process.cwd(), 'dist', 'db', 'migrations'),
    join(process.cwd(), 'db', 'migrations'),
  ];
  return candidates.find((c) => existsSync(c)) ?? candidates[0];
}

function defaultDeps(): SqlMigrationDeps {
  return {
    connect: (cfg) =>
      mysql.createConnection({
        host: cfg.host,
        port: cfg.port,
        user: cfg.user,
        password: cfg.password,
        database: cfg.database,
        multipleStatements: true,
      }),
    readdir: (dir) => fs.readdir(dir),
    readFile: (p) => fs.readFile(p, 'utf-8'),
    exists: existsSync,
  };
}

/**
 * 执行待应用迁移。失败即抛错（绝不静默跳过，避免「部分迁移」假成功）。
 */
export async function runSqlMigrations(
  cfg: SqlMigrationConfig,
  deps: SqlMigrationDeps = defaultDeps(),
): Promise<SqlMigrationResult> {
  const log = cfg.log ?? ((m: string) => console.log(`[migrate] ${m}`));
  const dir = resolveMigrationsDir(cfg.migrationsDir);
  const files = (await deps.readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  const conn = await deps.connect(cfg);
  const result: SqlMigrationResult = { applied: [], skipped: 0, baselined: false };
  try {
    await conn.query(
      'CREATE TABLE IF NOT EXISTS __migrations (name VARCHAR(255) PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)',
    );
    const [rows] = await conn.query('SELECT name FROM __migrations');
    const applied = new Set(
      (Array.isArray(rows) ? rows : []).map((r) => String((r as { name: unknown }).name)),
    );

    // 首次引入追踪：库已有业务表则基线化（避免重跑历史非幂等 ALTER）
    if (applied.size === 0) {
      // 注意：query 返回 [rows, fields]，必须解构后才能判空，否则空库会被误判为「已有库」而全部跳过
      const [existingRows] = await conn.query('SHOW TABLES LIKE ?', ['ops_accounts']);
      if (Array.isArray(existingRows) && existingRows.length > 0) {
        for (const file of files) {
          await conn.query('INSERT IGNORE INTO __migrations (name) VALUES (?)', [file]);
          applied.add(file);
        }
        result.baselined = true;
        log(`已基线化现有库（${files.length} 个迁移标记为已应用）`);
      }
    }

    for (const file of files) {
      if (applied.has(file)) {
        result.skipped += 1;
        continue;
      }
      const sql = await deps.readFile(join(dir, file));
      await conn.query(sql);
      await conn.query('INSERT INTO __migrations (name) VALUES (?)', [file]);
      result.applied.push(file);
      log(`已应用 ${file}`);
    }
    log(
      `迁移完成：应用 ${result.applied.length} 个，跳过 ${result.skipped} 个` +
        (result.baselined ? '（已基线化）' : ''),
    );
    return result;
  } finally {
    await conn.end().catch(() => undefined);
  }
}
