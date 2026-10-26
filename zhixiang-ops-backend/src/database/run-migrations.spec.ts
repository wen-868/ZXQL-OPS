import { runSqlMigrations, resolveMigrationsDir, type SqlMigrationConfig, type SqlMigrationDeps } from './run-migrations';

/**
 * 启动期迁移执行器测试（注入 mock 连接与虚拟文件系统，不触真实数据库）。
 */
describe('runSqlMigrations', () => {
  const cfg: SqlMigrationConfig = {
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '',
    database: 'zhixiang_ops',
    migrationsDir: 'D:/migrations',
    log: () => undefined,
  };

  const files = ['001_a.sql', '002_b.sql', '003_c.sql'];

  function makeDeps(opts: { applied?: string[]; hasAccountsTable?: boolean } = {}) {
    const executed: string[] = [];
    const queries: Array<{ sql: string; params?: unknown[] }> = [];
    const conn = {
      query: jest.fn(async (sql: string, params?: unknown[]) => {
        queries.push({ sql, params });
        if (sql.startsWith('SELECT name FROM __migrations')) {
          return [(opts.applied ?? []).map((name) => ({ name }))];
        }
        if (sql.startsWith('SHOW TABLES')) {
          return opts.hasAccountsTable ? [['ops_accounts']] : [];
        }
        if (sql.startsWith('INSERT') || sql.startsWith('DELETE')) return [];
        if (sql.startsWith('CREATE TABLE IF NOT EXISTS __migrations')) return [];
        executed.push(sql);
        return [];
      }),
      end: jest.fn(async () => undefined),
    };
    const deps: SqlMigrationDeps = {
      connect: jest.fn(async () => conn as never),
      readdir: jest.fn(async () => files),
      readFile: jest.fn(async (p: string) => `-- ${p}`),
      exists: () => true,
    };
    return { deps, conn, executed, queries };
  }

  it('首次空库：按序应用全部迁移并记录', async () => {
    const { deps, executed } = makeDeps();
    const r = await runSqlMigrations(cfg, deps);
    expect(r.applied).toEqual(files);
    expect(r.baselined).toBe(false);
    expect(executed).toHaveLength(3);
    expect(deps.readFile).toHaveBeenCalledWith(expect.stringContaining('001_a.sql'));
  });

  it('已应用的迁移自动跳过', async () => {
    const { deps, executed } = makeDeps({ applied: ['001_a.sql', '002_b.sql'] });
    const r = await runSqlMigrations(cfg, deps);
    expect(r.applied).toEqual(['003_c.sql']);
    expect(r.skipped).toBe(2);
    expect(executed).toHaveLength(1);
  });

  it('现有库（有 ops_accounts）首次引入追踪 → 基线化并全部跳过', async () => {
    const { deps, executed } = makeDeps({ hasAccountsTable: true });
    const r = await runSqlMigrations(cfg, deps);
    expect(r.baselined).toBe(true);
    expect(r.applied).toEqual([]);
    expect(r.skipped).toBe(3);
    expect(executed).toHaveLength(0);
  });

  it('迁移失败 → 抛错且关闭连接（不静默跳过）', async () => {
    const { deps, conn, executed } = makeDeps();
    (deps.readFile as jest.Mock).mockImplementation(async (p: string) => {
      if (p.includes('002_b.sql')) throw new Error('boom');
      return `-- ${p}`;
    });
    await expect(runSqlMigrations(cfg, deps)).rejects.toThrow('boom');
    expect(conn.end).toHaveBeenCalled();
    expect(executed).toHaveLength(1); // 仅 001 执行成功
  });

  describe('resolveMigrationsDir', () => {
    it('显式路径优先', () => {
      expect(resolveMigrationsDir('D:/custom')).toBe('D:/custom');
    });
    it('由 __dirname 推导（源码/编译均适用）', () => {
      const dir = resolveMigrationsDir(undefined, 'D:/proj/src/database');
      expect(dir).toMatch(/db[\\/]migrations$/);
    });
  });
});
