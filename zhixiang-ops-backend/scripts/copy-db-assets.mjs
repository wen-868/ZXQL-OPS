/**
 * 构建后资源复制：将 db/migrations/*.sql 与 db/seeds/*.sql 复制到 dist/db/，
 * 使编译产物自带迁移脚本，生产环境 `node dist/db/migrate.js` 可离线建表。
 * 由 package.json 的 postbuild 自动调用。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const srcDb = path.join(root, 'db');
const dstDb = path.join(root, 'dist', 'db');

for (const dir of ['migrations', 'seeds']) {
  const srcDir = path.join(srcDb, dir);
  const dstDir = path.join(dstDb, dir);
  if (!fs.existsSync(srcDir)) continue;
  // 先清空目标目录：删除已归档/改名/删除的脚本，避免旧迁移残留被误执行
  fs.rmSync(dstDir, { recursive: true, force: true });
  fs.mkdirSync(dstDir, { recursive: true });
  let count = 0;
  for (const f of fs.readdirSync(srcDir)) {
    if (f.endsWith('.sql')) {
      fs.copyFileSync(path.join(srcDir, f), path.join(dstDir, f));
      count++;
    }
  }
  console.log(`[copy-db-assets] ${dir}/ → dist/db/${dir}/ : ${count} 个 .sql`);
}
