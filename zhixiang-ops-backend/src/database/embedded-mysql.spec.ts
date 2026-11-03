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
    // OPS-EMBEDDED-MYSQL-OOM-RESILIENCE-01：注入 readyTimeoutMs + sleep mock 零延迟时
    // 实现的探测次数硬上限封顶循环（此前 90s 真实时钟 deadline 会全速自旋耗尽 4.1GB 堆）
    const { deps } = makeDeps({ probeTcp: jest.fn().mockResolvedValue(false) });
    await expect(
      ensureEmbeddedMysql({ ...baseCfg, readyTimeoutMs: 200 }, deps),
    ).rejects.toThrow('启动超时');
  });

  it('readyTimeoutMs 双上限：探测次数封顶（时钟无关），超时后不再无限自旋', async () => {
    let probeCalls = 0;
    const { deps } = makeDeps({
      probeTcp: jest.fn().mockImplementation(async () => {
        probeCalls++;
        return false;
      }),
    });
    await expect(
      ensureEmbeddedMysql({ ...baseCfg, readyTimeoutMs: 200 }, deps),
    ).rejects.toThrow('启动超时');
    // 封顶 = 每次 waitReady ceil(200/250)+2 = 2 次探测（与时钟无关的硬上限）；
    // 首次 + 自愈重试共两轮 waitReady → 4 次（对照修复前：90s 全速自旋可达数十万次）
    expect(probeCalls).toBeLessThanOrEqual(4);
  });

  // ===== OPS-EMBEDDED-MYSQL-OOM-RESILIENCE-01 资源生命周期契约（五条清理路径）=====

  it('成功路径 stopOnExit=false：child detached+unref，stopEmbeddedMysql 不 kill（宿主退出不误杀）', async () => {
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
      setTimeout(() => handlers['exit']?.(0), 0);
      return child;
    });
    const probe = jest.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    const { deps } = makeDeps({ spawnFn, probeTcp: probe });
    await ensureEmbeddedMysql({ ...baseCfg, stopOnExit: false }, deps);
    const child = spawnFn.mock.results[0].value;
    expect(child.unref).toHaveBeenCalled(); // 资源交还宿主
    await stopEmbeddedMysql({ log: () => undefined } as never);
    expect(child.kill).not.toHaveBeenCalled(); // 非托管模式不误杀
  });

  it('成功路径 stopOnExit=true：stopEmbeddedMysql 托管 kill，且幂等（第二次 no-op 不抛错）', async () => {
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
      setTimeout(() => handlers['exit']?.(0), 0);
      return child;
    });
    const probe = jest.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    const { deps } = makeDeps({ spawnFn, probeTcp: probe });
    await ensureEmbeddedMysql({ ...baseCfg, stopOnExit: true }, deps);
    const child = spawnFn.mock.results[0].value;
    await stopEmbeddedMysql({ log: () => undefined } as never);
    expect(child.kill).toHaveBeenCalledTimes(1);
    await expect(stopEmbeddedMysql({ log: () => undefined } as never)).resolves.toBeUndefined();
    expect(child.kill).toHaveBeenCalledTimes(1); // 幂等：第二次零新增
  });

  it('失败路径自愈清理：kill+removeDir+重初始化+启动就绪（错误路径不残留）', async () => {
    // 场景：mysql 库存在（已初始化）但完成哨兵缺席（首启被中断残留）
    //      → 首次启动失败（readyTimeoutMs 封顶超时）→ 自愈：kill + 清目录 + 重初始化 + 启动就绪
    let spawnSeq = 0;
    const spawnFn = jest.fn(() => {
      spawnSeq += 1;
      const handlers: Record<string, Function> = {};
      const child: any = {
        once: (ev: string, fn: Function) => {
          handlers[ev] = fn;
          return child;
        },
        unref: jest.fn(),
        kill: jest.fn(),
      };
      if (spawnSeq === 2) {
        setTimeout(() => handlers['exit']?.(0), 0); // 自愈重初始化成功
      } // spawnSeq 1/3 为启动进程：不退出，由 probeTcp 判定（probe 恒 false → 两次超时）
      return child;
    });
    const probe = jest.fn().mockResolvedValue(false);
    const existsSync = ((pp: string) =>
        pp.endsWith('mysqld.exe') || (pp.includes('mysql') && !pp.endsWith('.ops-initialized'))
      ) as never; // 哨兵缺席
    const { deps } = makeDeps({ spawnFn, probeTcp: probe, existsSync });
    const t0 = Date.now();
    await expect(
      ensureEmbeddedMysql({ ...baseCfg, readyTimeoutMs: 200 }, deps),
    ).rejects.toThrow('启动超时');
    const inst1 = (spawnFn.mock.calls[0] as unknown[])[1] as string[];
    expect(inst1.some((a) => a === '--initialize-insecure')).toBe(false); // 首次为启动而非初始化
    expect(deps.removeDir).toHaveBeenCalled(); // 错误路径清理执行（自愈）
    expect(deps.mkdirSync).toHaveBeenCalled(); // 清理后重建目录
    // 并发实例治理：旧启动实例必须被 kill（否则新旧 mysqld 并存翻倍）
    const firstChild = spawnFn.mock.results[0].value as { kill: jest.Mock };
    expect(firstChild.kill).toHaveBeenCalled();
    expect(Date.now() - t0).toBeLessThan(5000); // 两轮均被封顶，无 90s 自旋
  });

  it('异常中断路径：spawn 触发 error → 拒绝且目录清理（初始化阶段无 child 可 kill）', async () => {
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
      setTimeout(() => handlers['error']?.(new Error('spawn 崩溃')), 0);
      return child;
    });
    const probe = jest.fn().mockResolvedValue(false);
    // 完成哨兵缺席（首启被中断的残留）→ 启动失败后进入自愈清理
    const existsSync = ((pp: string) => !pp.endsWith('.' + 'ops-initialized')) as never;
    const { deps } = makeDeps({ spawnFn, probeTcp: probe, existsSync });
    await expect(
      ensureEmbeddedMysql({ ...baseCfg, readyTimeoutMs: 200 }, deps),
    ).rejects.toThrow();
    expect(deps.removeDir).toHaveBeenCalled(); // 异常路径同样清理（初始化阶段无 child，以目录清理断言）
  });

  it('超时路径 readyTimeoutMs 双上限封顶（时钟无关，防自旋 OOM）', async () => {
    let probeCalls = 0;
    const { deps } = makeDeps({
      probeTcp: jest.fn().mockImplementation(async () => {
        probeCalls++;
        return false;
      }),
    });
    await expect(
      ensureEmbeddedMysql({ ...baseCfg, readyTimeoutMs: 200 }, deps),
    ).rejects.toThrow('启动超时');
    // 首次 + 自愈重试各一轮，每轮封顶 ceil(200/250)+2 = 2 次
    expect(probeCalls).toBeLessThanOrEqual(4);
  });

  it('超时路径：readyTimeoutMs 生效使套件毫秒级完成（对照修复前 90s 自旋 OOM）', async () => {
    const t0 = Date.now();
    const { deps } = makeDeps({ probeTcp: jest.fn().mockResolvedValue(false) });
    await expect(
      ensureEmbeddedMysql({ ...baseCfg, readyTimeoutMs: 200 }, deps),
    ).rejects.toThrow('启动超时');
    expect(Date.now() - t0).toBeLessThan(5000); // 修复前：90s 自旋
  });

  it('stopOnExit=false 时 stopEmbeddedMysql 为 no-op（托管门不放行）', async () => {
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
      setTimeout(() => handlers['exit']?.(0), 0);
      return child;
    });
    const probe = jest.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    const { deps } = makeDeps({ spawnFn, probeTcp: probe });
    await ensureEmbeddedMysql({ ...baseCfg, stopOnExit: false }, deps);
    await stopEmbeddedMysql({ log: () => undefined } as never);
    const child = spawnFn.mock.results[0].value;
    expect(child.kill).not.toHaveBeenCalled();
  });

  it('资源生命周期契约：startMysqld 全程仅一次 spawn（无并发实例翻倍）', async () => {
    const probe = jest.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
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
      setTimeout(() => handlers['exit']?.(0), 0);
      return child;
    });
    const { deps } = makeDeps({ spawnFn, probeTcp: probe });
    await ensureEmbeddedMysql({ ...baseCfg, stopOnExit: false }, deps);
    expect(spawnFn).toHaveBeenCalledTimes(1); // 无并发实例翻倍
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
