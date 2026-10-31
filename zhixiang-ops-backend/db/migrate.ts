/**
 * 数据库迁移执行脚本。
 * 按顺序执行 db/migrations/ 目录下所有 .sql 文件（__migrations 追踪，已应用自动跳过）。
 * 回退模式：--rollback [N] —— 按 applied_at 倒序回退最近 N 个（默认 1）已应用迁移，
 *           执行 db/rollback/<同名>_down.sql，缺失即中止（绝不静默跳过）。
 *
 * 用法: npx ts-node db/migrate.ts  (开发)
 *       npx ts-node db/migrate.ts --rollback 2
 *       node db/migrate.js          (编译后)
 *
 * 依赖环境变量: DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME
 */
import 'dotenv/config';
import { promises as fs } from 'fs';
import * as path from 'path';
import mysql from 'mysql2/promise';
// OPS-SECURITY-MIGRATE-WHITELIST-01：迁移文件名白名单纯策略（唯一正则出处 src/database/migration-file-policy.ts）
import { filterAndSortMigrationNames } from '../src/database/migration-file-policy';

async function createConnection(): Promise<mysql.Connection> {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'zhixiang_ops',
    multipleStatements: true,
  });
  console.log(
    `[migrate] 已连接 ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  );
  return conn;
}

async function listMigrationFiles(): Promise<string[]> {
  const migrationsDir = path.resolve(__dirname, 'migrations');
  // OPS-SECURITY-MIGRATE-WHITELIST-01：白名单过滤 + 排序（纯策略见 src/database/migration-file-policy.ts）
  return filterAndSortMigrationNames(await fs.readdir(migrationsDir));
}

/** 正向迁移：已应用（__migrations 追踪）自动跳过 */
async function migrate(conn: mysql.Connection, files: string[]): Promise<void> {
  // 迁移追踪：已应用的文件跳过（部分历史迁移含非幂等 ALTER，重跑会失败）
  await conn.query(
    'CREATE TABLE IF NOT EXISTS __migrations (name VARCHAR(255) PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)',
  );
  const [appliedRows] = await conn.query('SELECT name FROM __migrations');
  const applied = new Set(
    (Array.isArray(appliedRows) ? appliedRows : []).map((r) => String((r as { name: unknown }).name)),
  );

  // 首次引入追踪：若库已有业务表，则把现有迁移文件基线化为已应用（避免重跑历史 ALTER）
  if (applied.size === 0) {
    // query 返回 [rows, fields]，必须解构判空，否则空库被误判为「已有库」而全部跳过
    const [existingRows] = await conn.query('SHOW TABLES LIKE ?', ['ops_accounts']);
    if (Array.isArray(existingRows) && existingRows.length > 0) {
      for (const file of files) {
        await conn.query('INSERT IGNORE INTO __migrations (name) VALUES (?)', [file]);
        applied.add(file);
      }
      console.log(`[migrate] 已基线化现有库（${files.length} 个历史迁移标记为已应用）`);
    }
  }

  const migrationsDir = path.resolve(__dirname, 'migrations');
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`[migrate] 跳过（已应用）: ${file}`);
      continue;
    }
    // file 来自上方 readdir(项目自身 migrations 目录) 结果，非用户输入
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const sql = await fs.readFile(path.join(migrationsDir, file), 'utf-8');
    console.log(`[migrate] 执行: ${file} (${sql.length} bytes)`);
    try {
      await conn.query(sql);
      await conn.query('INSERT INTO __migrations (name) VALUES (?)', [file]);
      console.log(`  ✓ 完成`);
    } catch (err: unknown) {
      // 失败即中止（静默继续会造成"部分迁移"假成功）
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ 失败: ${msg}`);
      await conn.end().catch(() => {});
      console.error(`[migrate] 中止：${file} 执行失败，数据库保持本次执行前的状态`);
      process.exit(1);
    }
  }
  console.log('[migrate] 迁移完成');
}

/** 回退最近 N 个已应用迁移（按 applied_at 倒序），逐个执行 db/rollback/<name>_down.sql */
async function rollback(conn: mysql.Connection, count: number): Promise<void> {
  const [appliedRows] = await conn.query(
    'SELECT name FROM __migrations ORDER BY applied_at DESC, name DESC LIMIT ?',
    [count],
  );
  const targets = (Array.isArray(appliedRows) ? appliedRows : []).map((r) =>
    String((r as { name: unknown }).name),
  );
  if (targets.length === 0) {
    console.log('[rollback] 没有可回退的迁移记录');
    return;
  }

  const rollbackDir = path.resolve(__dirname, 'rollback');
  for (const name of targets) {
    // name 来自 __migrations 表（历史 readdir 结果），非用户输入
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const downPath = path.join(rollbackDir, `${name.replace(/\.sql$/, '')}_down.sql`);
    let sql: string;
    try {
      sql = await fs.readFile(downPath, 'utf-8');
    } catch {
      console.error(`[rollback] ✗ 缺少回退脚本: ${downPath}`);
      await conn.end().catch(() => {});
      console.error('[rollback] 中止：宁可不回退，也不静默跳过造成半回退状态');
      process.exit(1);
    }
    console.log(`[rollback] 回退: ${name}`);
    try {
      await conn.query(sql);
      await conn.query('DELETE FROM __migrations WHERE name = ?', [name]);
      console.log('  ✓ 完成');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ 失败: ${msg}`);
      await conn.end().catch(() => {});
      console.error(`[rollback] 中止：${name} 回退失败，请人工检查数据库状态`);
      process.exit(1);
    }
  }
  console.log(`[rollback] 已回退 ${targets.length} 个迁移`);
}

async function main(): Promise<void> {
  const conn = await createConnection();
  const rollbackIdx = process.argv.indexOf('--rollback');
  if (rollbackIdx >= 0) {
    const arg = Number(process.argv[rollbackIdx + 1]);
    await rollback(conn, Number.isInteger(arg) && arg > 0 ? arg : 1);
  } else {
    await migrate(conn, await listMigrationFiles());
  }
  await conn.end();
}

main().catch((err: unknown) => {
  console.error('[migrate] 致命错误:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
