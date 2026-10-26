import {
  ensureEmbeddedMysql,
  resolveMysqlHome,
  stopEmbeddedMysql,
  type EmbeddedMysqlConfig,
  type EmbeddedMysqlDeps,
} from './embedded-mysql';

/**
 * 内嵌 MySQL 启动器测试（不启动真实 mysqld：spawn/探测/建库全部注入 mock）。
 * 覆盖：模式开关、端口复用、二进制解析、首次初始化、就绪等待、失败诊断、退出清理。
 */
describe('ensureEmbeddedMysql', () => {
  const baseCfg: EmbeddedMysqlConfig = {
    mode: 'auto',
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '',
    database: 'zhixiang_ops',
    rootDir: 'D:/app',
    stopOnExit: false,
  };

  function makeDeps(over: Partial<EmbeddedMysqlDeps> & { spawnFn?: jest.Mock } = {}) {
    const events: string[] = [];
    const spawnFn =
      over.spawnFn ??
      jest.fn(() => {
        const handlers: Record<string, Function> = {};
        const child: any = {
          once: (ev: string, fn: Function) => {
            handlers[ev] = fn;
            return child;
          },
          unref: jest.fn(),
          kill: jest.fn(),
        };
        // 异步触发 exit(0)（模拟初始化成功）
        setTimeout(() => handlers['exit']?.(0), 0);
        return child;
      });
    const probeTcp = over.probeTcp ?? jest.fn().mockResolvedValue(false);
    const createDatabase = over.createDatabase ?? jest.fn().mockResolvedValue(undefined);
    const syncRootAuth = over.syncRootAuth ?? jest.fn().mockResolvedValue(undefined);
    const existsSync =
      over.existsSync ??
      ((p: string) => {
        if (p.endsWith('mysqld.exe')) return true;
        if (p.endsWith(`${'mysql'}`)) return true; // 数据目录已初始化
        return true;
      });
    const deps: EmbeddedMysqlDeps = {
      spawn: spawnFn as never,
      probeTcp: probeTcp as never,
      createDatabase: createDatabase as never,
      syncRootAuth: syncRootAuth as never,
      existsSync: existsSync as never,
      mkdirSync: jest.fn() as never,
      readdirSync: jest.fn().mockReturnValue([]) as never,
      writeFileSync: jest.fn() as never,
      removeDir: jest.fn() as never,
      log: jest.fn() as never,
      sleep: jest.fn().mockResolvedValue(undefined) as never,
      ...over,
    } as EmbeddedMysqlDeps;
    return { deps, spawnFn: spawnFn as jest.Mock, syncRootAuth: syncRootAuth as jest.Mock, events };
  }

  afterEach(async () => {
    await stopEmbeddedMysql({ log: () => undefined } as never);
  });

  it('mode=false 直接跳过，不探测不启动', async () => {
    const { deps, spawnFn } = makeDeps();
    const r = await ensureEmbeddedMysql({ ...baseCfg, mode: 'false' }, deps);
    expect(r.started).toBe(false);
    expect(deps.probeTcp).not.toHaveBeenCalled();
    expect(spawnFn).not.toHaveBeenCalled();
  });

  it('端口已在监听 → 复用现有实例', async () => {
    const { deps, spawnFn } = makeDeps({ probeTcp: jest.fn().mockResolvedValue(true) });
    const r = await ensureEmbeddedMysql(baseCfg, deps);
    expect(r.reused).toBe(true);
    expect(spawnFn).not.toHaveBeenCalled();
  });

  it('远程 DB_HOST 且 auto 模式 → 跳过内嵌', async () => {
    const { deps, spawnFn } = makeDeps();
    const r = await ensureEmbeddedMysql({ ...baseCfg, host: '10.0.0.5' }, deps);
    expect(r.started).toBe(false);
    expect(spawnFn).not.toHaveBeenCalled();
  });

  it('远程 DB_HOST 且 mode=true → 报错', async () => {
    const { deps } = makeDeps();
    await expect(ensureEmbeddedMysql({ ...baseCfg, host: '10.0.0.5', mode: 'true' }, deps)).rejects.toThrow(
      '内嵌 MySQL 仅支持本地绑定',
    );
  });

  it('无二进制：auto 跳过、true 报错', async () => {
    const noBin = (p: string) => !p.includes('mysqld') && !p.includes('mysql-');
    const noHome = makeDeps({
      existsSync: noBin as never,
      readdirSync: jest.fn().mockReturnValue([]) as never,
    });
    const r = await ensureEmbeddedMysql(baseCfg, noHome.deps);
    expect(r.started).toBe(false);

    const strict = makeDeps({
      existsSync: noBin as never,
      readdirSync: jest.fn().mockReturnValue([]) as never,
    });
    await expect(ensureEmbeddedMysql({ ...baseCfg, mode: 'true' }, strict.deps)).rejects.toThrow(
      '未找到内嵌 MySQL 二进制',
    );
  });

  it('数据目录已初始化：直接启动并建库', async () => {
    const probe = jest.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    const { deps, spawnFn, syncRootAuth } = makeDeps({ probeTcp: probe });
    const r = await ensureEmbeddedMysql(baseCfg, deps);
    expect(r.started).toBe(true);
    // 仅启动一次（无 --initialize-insecure）
    expect(spawnFn).toHaveBeenCalledTimes(1);
    const args = spawnFn.mock.calls[0][1] as string[];
    expect(args.some((a) => a === '--initialize-insecure')).toBe(false);
    expect(args).toContain('--bind-address=127.0.0.1');
    // 每次启动都幂等同步 root 认证（自愈中断残留）
    expect(syncRootAuth).toHaveBeenCalledWith(
      expect.objectContaining({ user: 'root', port: 3306 }),
    );
    expect(deps.createDatabase).toHaveBeenCalledWith(
      expect.objectContaining({ database: 'zhixiang_ops', port: 3306 }),
    );
  });

  it('数据目录为空：先 initialize 再启动', async () => {
    const probe = jest.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    const { deps, spawnFn } = makeDeps({
      probeTcp: probe,
      existsSync: ((p: string) => {
        if (p.endsWith('mysqld.exe')) return true;
        if (p.includes('mysql-data')) return false; // 未初始化
        return true;
      }) as never,
    });
    const r = await ensureEmbeddedMysql(baseCfg, deps);
    expect(r.started).toBe(true);
    expect(spawnFn).toHaveBeenCalledTimes(2); // init + start
    expect((spawnFn.mock.calls[0][1] as string[]).some((a) => a === '--initialize-insecure')).toBe(true);
  });

  it('有 mysql 库但无完成哨兵且启动失败 → 清空重建（自愈首启被中断）', async () => {
    let call = 0;
    const spawnFn = jest.fn((_bin: string, _args: string[]) => {
      call += 1;
      const handlers: Record<string, Function> = {};
      const child: any = {
        exitCode: call === 1 ? 1 : undefined, // 第 1 次启动即失败；第 3 次启动成功
        once: (ev: string, fn: Function) => {
          handlers[ev] = fn;
          if (call === 2) setTimeout(() => handlers['exit']?.(0), 0); // 重建初始化成功
          return child;
        },
        unref: jest.fn(),
        kill: jest.fn(),
      };
      return child;
    });
    const probe = jest.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    const { deps } = makeDeps({
      spawnFn,
      probeTcp: probe,
      existsSync: ((p: string) => {
        if (p.endsWith('mysqld.exe')) return true;
        if (p.includes('mysql-data')) return p.endsWith('mysql'); // 有 mysql 库、无哨兵
        return true;
      }) as never,
      readdirSync: jest.fn().mockReturnValue(['ibdata1', 'undo_001']) as never,
    });
    const r = await ensureEmbeddedMysql(baseCfg, deps);
    expect(r.started).toBe(true);
    expect(deps.removeDir).toHaveBeenCalled();
    expect(spawnFn).toHaveBeenCalledTimes(3); // 启动失败 → 重建初始化 → 再次启动
    expect((spawnFn.mock.calls[1][1] as string[]).some((a) => a === '--initialize-insecure')).toBe(true);
  });

  it('有 mysql 库但无哨兵且启动成功 → 视为有效库，不清空', async () => {
    const probe = jest.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    const { deps, spawnFn } = makeDeps({
      probeTcp: probe,
      existsSync: ((p: string) => {
        if (p.endsWith('mysqld.exe')) return true;
        if (p.includes('mysql-data')) return p.endsWith('mysql'); // 有库、无哨兵
        return true;
      }) as never,
    });
    const r = await ensureEmbeddedMysql(baseCfg, deps);
    expect(r.started).toBe(true);
    expect(deps.removeDir).not.toHaveBeenCalled(); // 绝不盲目删库
    expect(spawnFn).toHaveBeenCalledTimes(1);
  });

  it('初始化子进程失败 → 抛错', async () => {
    const probe = jest.fn().mockResolvedValue(false);
    const spawnFn = jest.fn(() => {
      const handlers: Record<string, Function> = {};
      const child: any = {
        once: (ev: string, fn: Function) => {
          handlers[ev] = fn;
          return child;
        },
        unref: jest.fn(),
        kill: jest.fn(),
      };
      setTimeout(() => handlers['exit']?.(1), 0);
      return child;
    });
    const { deps } = makeDeps({
      spawnFn,
      probeTcp: probe,
      existsSync: ((p: string) => {
        if (p.endsWith('mysqld.exe')) return true;
        if (p.includes('mysql-data')) return false;
        return true;
      }) as never,
    });
    await expect(ensureEmbeddedMysql(baseCfg, deps)).rejects.toThrow('mysqld 初始化失败');
  });

  it('就绪等待超时 → 抛错并提示错误日志', async () => {
    const { deps } = makeDeps({ probeTcp: jest.fn().mockResolvedValue(false) });
    await expect(ensureEmbeddedMysql(baseCfg, deps)).rejects.toThrow('启动超时');
  });

  describe('resolveMysqlHome', () => {
    const exists = (p: string) => p.includes('mysqld');
    it('优先采用显式 OPS_MYSQL_HOME', () => {
      expect(resolveMysqlHome('D:/app', 'D:/custom', exists, () => [])).toBe('D:/custom');
    });
    it('回退 vendor/mysql', () => {
      expect(resolveMysqlHome('D:/app', undefined, exists, () => [])).toBe(
        require('node:path').join('D:/app', 'vendor', 'mysql'),
      );
    });
    it('扫描 tools/mysql-* 目录', () => {
      const found = resolveMysqlHome(
        'D:/app',
        undefined,
        (p) => p.endsWith('tools') || (p.includes('mysql-8.0.28') && p.includes('mysqld')),
        (p) => (p.endsWith('tools') ? ['mysql-8.0.28-winx64'] : []),
      );
      expect(found).toContain('mysql-8.0.28-winx64');
    });
    it('全部缺失返回 null', () => {
      expect(resolveMysqlHome('D:/app', undefined, () => false, () => [])).toBeNull();
    });
  });
});
