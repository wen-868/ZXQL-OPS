/**
 * 数据库迁移执行脚本。
 * 按顺序执行 db/migrations/ 目录下所有 .sql 文件。
 *
 * 用法: npx ts-node db/migrate.ts  (开发)
 *       node db/migrate.js          (编译后)
 *
 * 依赖环境变量: DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME
 */
import 'dotenv/config';
import { promises as fs } from 'fs';
import * as path from 'path';
import mysql from 'mysql2/promise';

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'zhixiang_ops',
    multipleStatements: true,
  });

  console.log(`[migrate] 已连接 ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);

  const migrationsDir = path.resolve(__dirname, 'migrations');
  const files = (await fs.readdir(migrationsDir))
    .filter((f) => f.endsWith('.sql'))
    .sort(); // 按文件名排序（001, 002, ...）

  for (const file of files) {
    const sql = await fs.readFile(path.join(migrationsDir, file), 'utf-8');
    console.log(`[migrate] 执行: ${file} (${sql.length} bytes)`);
    try {
      await conn.query(sql);
      console.log(`  ✓ 完成`);
    } catch (err: any) {
      console.error(`  ✗ 失败: ${err.message}`);
    }
  }

  await conn.end();
  console.log('[migrate] 迁移完成');
}

main().catch((err) => {
  console.error('[migrate] 致命错误:', err.message);
  process.exit(1);
});
