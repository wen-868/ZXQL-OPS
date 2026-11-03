/**
 * 内嵌 MySQL 启动器（运营系统自带数据库，不自挂外置实例）。
 *
 * 打包运行的运营系统应在应用启动时托管拉起内嵌 mysqld：
 *  1) 端口已在监听 → 视为已运行（复用，兼容 watch 重启与外部实例）
 *  2) 数据目录为空 → mysqld --initialize-insecure 初始化
 *  3) 以 127.0.0.1 绑定 + utf8mb4 + native password 启动 mysqld
 *  4) 用 mysql2 建库（utf8mb4）+（如配置了 DB_PASSWORD）设置 root 密码
 *
 * 二进制位置解析顺序：OPS_MYSQL_HOME → <root>/vendor/mysql → <root>/tools/mysql-*-winx64
 * 关闭策略：OPS_MYSQL_STOP_ON_EXIT=true 时随应用退出停止（打包本地运行推荐）。
 */
import { spawn as nodeSpawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createConnection as netConnect } from 'node:net';
import { join } from 'node:path';
import mysql from 'mysql2/promise';

export interface EmbeddedMysqlConfig {
  /** auto=有二进制则内嵌启动；true=强制内嵌（缺失报错）；false=关闭 */
  mode: 'auto' | 'true' | 'false';
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  /** 应用根目录（二进制与数据目录的解析基准） */
  rootDir: string;
  /** 显式指定 MySQL 二进制目录 */
  home?: string;
  /** 显式指定数据目录 */
  dataDir?: string;
  /** 就绪等待上限（毫秒，默认 90000）。测试可注入小值避免真实时钟自旋 */
  readyTimeoutMs?: number;
  stopOnExit: boolean;
}

export interface EmbeddedMysqlDeps {
  spawn: typeof nodeSpawn;
  probeTcp: (host: string, port: number, timeoutMs?: number) => Promise<boolean>;
  createDatabase: (opts: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  }) => Promise<void>;
  /** 幂等同步 root 认证：能按配置密码连接则跳过；否则以空密码接管并设置（首次初始化/改密场景） */
  syncRootAuth: (opts: { host: string; port: number; user: string; password: string }) => Promise<void>;
  existsSync: (p: string) => boolean;
  mkdirSync: (p: string, opts?: { recursive?: boolean }) => void;
  readdirSync: (p: string) => string[];
  writeFileSync: (p: string, data: string) => void;
  removeDir: (p: string) => void;
  log: (msg: string, level?: 'info' | 'warn' | 'error') => void;
  sleep: (ms: number) => Promise<void>;
}

export interface EmbeddedMysqlResult {
  started: boolean;
  reused?: boolean;
  home?: string;
}

/** 探测 TCP 端口是否可连接（超时视为不可用） */
export async function probeTcp(host: string, port: number, timeoutMs = 1500): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const sock = netConnect({ host, port });
    const done = (ok: boolean) => {
      sock.removeAllListeners();
      sock.destroy();
      resolve(ok);
    };
    sock.setTimeout(timeoutMs);
    sock.once('connect', () => done(true));
    sock.once('error', () => done(false));
    sock.once('timeout', () => done(false));
  });
}

/** 解析内嵌 MySQL 二进制目录（含 bin/mysqld 的目录） */
export function resolveMysqlHome(
  rootDir: string,
  explicitHome: string | undefined,
  exists: (p: string) => boolean,
  readdir: (p: string) => string[],
): string | null {
  const hasMysqld = (dir: string) => exists(join(dir, 'bin', 'mysqld.exe')) || exists(join(dir, 'bin', 'mysqld'));
  const candidates: string[] = [];
  if (explicitHome) candidates.push(explicitHome);
  candidates.push(join(rootDir, 'vendor', 'mysql'));
  // tools/mysql-<ver>-winx64（开发期下载目录）
  const toolsDir = join(rootDir, 'tools');
  if (exists(toolsDir)) {
    for (const name of readdir(toolsDir)) {
      if (name.startsWith('mysql-')) candidates.push(join(toolsDir, name));
    }
  }
  return candidates.find((c) => hasMysqld(c)) ?? null;
}

/** 默认依赖实现 */
function defaultDeps(): EmbeddedMysqlDeps {
  return {
    spawn: nodeSpawn,
    probeTcp,
    createDatabase: async ({ host, port, user, password, database }) => {
      const conn = await mysql.createConnection({ host, port, user, password, multipleStatements: true });
      try {
        await conn.query(
          `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
        );
      } finally {
        await conn.end().catch(() => undefined);
      }
    },
    syncRootAuth: async ({ host, port, user, password }) => {
      const canConnect = async (pwd: string): Promise<boolean> => {
        try {
          const c = await mysql.createConnection({ host, port, user, password: pwd, connectTimeout: 3000 });
          await c.end().catch(() => undefined);
          return true;
        } catch {
          return false;
        }
      };
      if (await canConnect(password)) return; // 密码一致
      if (!(await canConnect(''))) return; // 空密码也不通：非本进程可控，交由 TypeORM 报错
      if (!password) return; // 期望空密码且已可用
      const conn = await mysql.createConnection({
        host,
        port,
        user,
        password: '',
        multipleStatements: true,
      });
      try {
        const pwd = password.replace(/'/g, "''");
        await conn.query(
          `ALTER USER '${user}'@'localhost' IDENTIFIED WITH mysql_native_password BY '${pwd}';` +
            `CREATE USER IF NOT EXISTS '${user}'@'127.0.0.1' IDENTIFIED WITH mysql_native_password BY '${pwd}';` +
            `GRANT ALL PRIVILEGES ON *.* TO '${user}'@'127.0.0.1' WITH GRANT OPTION;` +
            `FLUSH PRIVILEGES;`,
        );
      } finally {
        await conn.end().catch(() => undefined);
      }
    },
    existsSync,
    mkdirSync: (p, opts) => mkdirSync(p, opts),
    readdirSync,
    writeFileSync: (p, data) => writeFileSync(p, data, 'utf8'),
    removeDir: (p) => rmSync(p, { recursive: true, force: true }),
    log: (msg, level = 'info') => {
      const prefix = '[embedded-mysql]';
      if (level === 'error') console.error(prefix, msg);
      else if (level === 'warn') console.warn(prefix, msg);
      else console.log(prefix, msg);
    },
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  };
}

// 本进程托管启动的 mysqld 句柄（用于退出清理）
let managedChild: ChildProcess | null = null;
let managedStopOnExit = false;

/** 停止本进程托管启动的 mysqld（仅 stopOnExit 时执行） */
export async function stopEmbeddedMysql(deps: EmbeddedMysqlDeps = defaultDeps()): Promise<void> {
  if (!managedChild || !managedStopOnExit) return;
  try {
    deps.log('停止内嵌 mysqld');
    managedChild.kill();
  } catch {
    // 忽略
  }
  managedChild = null;
}

/**
 * 确保内嵌 MySQL 就绪。应在 NestFactory.create 之前调用（TypeORM 于应用初始化期建连）。
 */
export async function ensureEmbeddedMysql(
  cfg: EmbeddedMysqlConfig,
  deps: EmbeddedMysqlDeps = defaultDeps(),
): Promise<EmbeddedMysqlResult> {
  if (cfg.mode === 'false') return { started: false };

  const isLocal = cfg.host === '127.0.0.1' || cfg.host === 'localhost';
  if (!isLocal) {
    if (cfg.mode === 'true') {
      throw new Error(`内嵌 MySQL 仅支持本地绑定，当前 DB_HOST=${cfg.host}`);
    }
    return { started: false };
  }

  // 端口已在监听：复用（watch 重启 / 外部实例 / 上次残留）
  if (await deps.probeTcp(cfg.host, cfg.port)) {
    deps.log(`检测到 ${cfg.host}:${cfg.port} 已在运行，复用现有实例`, 'info');
    return { started: false, reused: true };
  }

  const home = resolveMysqlHome(cfg.rootDir, cfg.home, deps.existsSync, deps.readdirSync);
  if (!home) {
    if (cfg.mode === 'true') {
      throw new Error(
        `未找到内嵌 MySQL 二进制：请运行 npm run mysql:setup，或将 OPS_MYSQL_HOME 指向含 bin/mysqld 的目录`,
      );
    }
    deps.log('未找到内嵌 MySQL 二进制，跳过（按外部数据库模式继续）', 'warn');
    return { started: false };
  }

  // 注意：目录名不能以 '.' 开头——MySQL 8.0 在 Windows 上会因隐藏目录名在启动时报
  //   "Can't create UNDO tablespace innodb_undo_001 since '.\undo_001' already exists"（已实测）
  const dataDir = cfg.dataDir || join(cfg.rootDir, 'mysql-data');
  const mysqld = join(home, 'bin', 'mysqld.exe');
  const mysqldBin = deps.existsSync(mysqld) ? mysqld : join(home, 'bin', 'mysqld');
  const errLog = join(dataDir, 'mysqld.err');

  deps.mkdirSync(dataDir, { recursive: true });
  // 以 mysql 系统库 + 完成哨兵判定可用性：
  //  - 无 mysql 库：空目录或上次初始化被中断的残留 → 清空后初始化
  //  - 有 mysql 库但无哨兵：可能有效库（如外部置入）或首启被杀灭的残留
  //    → 先尝试启动，仅当启动失败才清空重建（绝不盲目删库）
  const sentinel = join(dataDir, '.ops-initialized');
  const initialized = deps.existsSync(join(dataDir, 'mysql'));
  const completed = deps.existsSync(sentinel);

  const initDatadir = async (): Promise<void> => {
    deps.log(`初始化数据目录（--initialize-insecure）: ${dataDir}`);
    await runAndWait(deps, mysqldBin, [
      `--basedir=${home}`,
      `--datadir=${dataDir}`,
      '--initialize-insecure',
      `--log-error=${errLog}`,
    ]);
  };

  if (!initialized) {
    if (deps.readdirSync(dataDir).length > 0) {
      deps.log('数据目录含未完成初始化残留，清空后重建', 'warn');
    }
    deps.removeDir(dataDir);
    deps.mkdirSync(dataDir, { recursive: true });
    await initDatadir();
  }

  let child: ChildProcess | undefined;
  try {
    child = startMysqld(deps, cfg, mysqldBin, home, dataDir, errLog);
    await waitReady(deps, cfg, child, errLog);
  } catch (err) {
    // 已正常启动过（哨兵在）→ 不擅自清库，直接上报
    if (completed) throw err;
    deps.log(`启动失败，按未完成初始化处理：清空重建后重试（${(err as Error).message}）`, 'warn');
    child?.kill();
    await deps.sleep(1000);
    deps.removeDir(dataDir);
    deps.mkdirSync(dataDir, { recursive: true });
    await initDatadir();
    child = startMysqld(deps, cfg, mysqldBin, home, dataDir, errLog);
    await waitReady(deps, cfg, child, errLog);
  }

  // 标记初始化完成（用于自愈中途被杀灭的场景）
  deps.writeFileSync(sentinel, new Date().toISOString());

  // 幂等同步 root 认证（首次初始化 / 改密 / 上次中断残留均可自愈）
  await deps.syncRootAuth({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
  });

  await deps.createDatabase({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
  });
  deps.log(`内嵌 MySQL 就绪：${cfg.host}:${cfg.port}/${cfg.database}`);
  return { started: true, home };
}

/** 启动 mysqld（托管句柄记录用于退出清理） */
function startMysqld(
  deps: EmbeddedMysqlDeps,
  cfg: EmbeddedMysqlConfig,
  mysqldBin: string,
  home: string,
  dataDir: string,
  errLog: string,
): ChildProcess {
  deps.log(`启动内嵌 mysqld: ${mysqldBin} (port=${cfg.port})`);
  const child = deps.spawn(
    mysqldBin,
    [
      `--basedir=${home}`,
      `--datadir=${dataDir}`,
      `--port=${cfg.port}`,
      '--bind-address=127.0.0.1',
      '--character-set-server=utf8mb4',
      '--collation-server=utf8mb4_unicode_ci',
      '--default-authentication-plugin=mysql_native_password',
      '--mysqlx=0',
      `--log-error=${errLog}`,
    ],
    { detached: !cfg.stopOnExit, stdio: 'ignore' },
  );
  if (!cfg.stopOnExit) child.unref?.();
  managedChild = child;
  managedStopOnExit = cfg.stopOnExit;
  return child;
}

/** 等待端口就绪；进程提前退出则立即失败，避免空等 90s */
async function waitReady(
  deps: EmbeddedMysqlDeps,
  cfg: EmbeddedMysqlConfig,
  child: ChildProcess,
  errLog: string,
): Promise<void> {
  // OPS-EMBEDDED-MYSQL-OOM-RESILIENCE-01：双上限——真实时钟 deadline + 探测次数硬上限
  // （次数上限与时钟无关：即使测试把 sleep mock 成零延迟，循环也不会全速自旋耗尽堆内存）
  const timeoutMs = cfg.readyTimeoutMs ?? 90_000;
  const deadline = Date.now() + timeoutMs;
  const maxProbes = Math.ceil(timeoutMs / 250) + 2;
  let probes = 0;
  while (Date.now() < deadline && probes < maxProbes) {
    probes++;
    if (child.exitCode !== null && child.exitCode !== undefined) {
      throw new Error(`内嵌 mysqld 启动失败（exit=${child.exitCode}），请查看错误日志: ${errLog}`);
    }
    if (await deps.probeTcp(cfg.host, cfg.port, 1000)) return;
    await deps.sleep(500);
  }
  throw new Error(`内嵌 mysqld 启动超时（等待 ${timeoutMs}ms，探测 ${probes} 次），请查看错误日志: ${errLog}`);
}

/** 等待子进程退出（初始化步骤）；非 0 退出抛错（附错误日志尾部） */
function runAndWait(deps: EmbeddedMysqlDeps, bin: string, args: string[]): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const child = deps.spawn(bin, args, { stdio: 'ignore' });
    child.once('error', (err) => reject(err));
    child.once('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`mysqld 初始化失败（exit=${code}），数据目录=${args[1]}`));
    });
  });
}
