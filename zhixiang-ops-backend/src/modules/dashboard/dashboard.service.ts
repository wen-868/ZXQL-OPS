import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { TenantContext } from '../../tenant/tenant-context';
import { Humanity } from '../../core/humanity-emotion';
import { DashboardConfigEntity } from './dashboard-config.entity';

export interface DashboardTodoItem {
  /** 待办类型：publish 发布审核 / cs 高风客诉 / reconcile 对账差异 / ad 投流计划 */
  type: 'publish' | 'cs' | 'reconcile' | 'ad';
  /** 待处理数量 */
  count: number;
  /** 摘要（最新一条的业务标识，无则空串） */
  latest: string;
}

export interface DashboardTrendPoint {
  /** 日期 MM-DD */
  date: string;
  /** 当日订单数 */
  orders: number;
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    @InjectRepository(DashboardConfigEntity)
    private readonly configRepo: Repository<DashboardConfigEntity>,
  ) {}

  /** 租户标识：AsyncLocalStorage 请求上下文（构造期无上下文，须按请求取） */
  private get tenantId(): string {
    return TenantContext.requireTenantId();
  }

  /** 运营统计概览 */
  async getStats(): Promise<{
    /** 账号数 */
    accounts: number;
    /** 脚本数 */
    scripts: number;
    /** 素材数 */
    materials: number;
    /** 视频成片数 */
    videos: number;
    /** 发布任务数 */
    publishes: number;
    /** 选题数 */
    topics: number;
    /** 情报数 */
    intels: number;
    /** 直播在线 */
    liveOnline: number;
    /** 今日订单 */
    todayOrders: number;
    /** 待审工单 */
    pendingTickets: number;
    /** 待复盘 */
    pendingReviews: number;
    /** 人性驱动分布 */
    humanDriverDistribution: Record<Humanity, number>;
    /** 最近操作日志 */
    recentActions: Array<{
      action: string;
      resource: string;
      timestamp: string;
      operator?: string;
    }>;
  }> {
    const toCount = (p: Promise<Array<{ cnt?: unknown }>>) =>
      p.then((rows) => Number(rows[0]?.cnt ?? 0)).catch(() => 0);

    const [
      accounts,
      scripts,
      materials,
      videos,
      publishes,
      topics,
      intels,
      liveOnline,
      todayOrders,
      pendingTickets,
      pendingReviews,
    ] = await Promise.all([
      toCount(
        this.ds.query('SELECT COUNT(*) as cnt FROM ops_accounts WHERE tenant_id = ?', [
          this.tenantId,
        ]),
      ),
      toCount(
        this.ds.query('SELECT COUNT(*) as cnt FROM ops_scripts WHERE tenant_id = ?', [
          this.tenantId,
        ]),
      ),
      toCount(
        this.ds.query('SELECT COUNT(*) as cnt FROM ops_materials WHERE tenant_id = ?', [
          this.tenantId,
        ]),
      ),
      toCount(
        this.ds.query('SELECT COUNT(*) as cnt FROM ops_videos WHERE tenant_id = ?', [
          this.tenantId,
        ]),
      ),
      toCount(
        this.ds.query('SELECT COUNT(*) as cnt FROM ops_publish_tasks WHERE tenant_id = ?', [
          this.tenantId,
        ]),
      ),
      toCount(
        this.ds.query('SELECT COUNT(*) as cnt FROM ops_topics WHERE tenant_id = ?', [
          this.tenantId,
        ]),
      ),
      toCount(
        this.ds.query('SELECT COUNT(*) as cnt FROM ops_intels WHERE tenant_id = ?', [
          this.tenantId,
        ]),
      ),
      toCount(
        this.ds.query(
          'SELECT COUNT(*) as cnt FROM ops_live_rooms WHERE tenant_id = ? AND status = ?',
          [this.tenantId, 'live'],
        ),
      ),
      toCount(
        this.ds.query(
          'SELECT COUNT(*) as cnt FROM ops_orders WHERE tenant_id = ? AND created_at >= CURRENT_DATE()',
          [this.tenantId],
        ),
      ),
      toCount(
        this.ds.query(
          'SELECT COUNT(*) as cnt FROM ops_support_tickets WHERE tenant_id = ? AND status IN (?, ?)',
          [this.tenantId, 'open', 'pending'],
        ),
      ),
      toCount(
        this.ds.query(
          'SELECT COUNT(*) as cnt FROM ops_recycle_tasks WHERE tenant_id = ? AND status IN (?, ?)',
          [this.tenantId, 'pending', 'running'],
        ),
      ),
    ]);

    // 人性驱动分布 + 最近操作日志（复用独立查询方法，表未初始化时各自降级）
    const [humanDriverDistribution, recentActions] = await Promise.all([
      this.getHumanityDistribution(),
      this.getRecentActions(),
    ]);

    return {
      accounts,
      scripts,
      materials,
      videos,
      publishes,
      topics,
      intels,
      liveOnline,
      todayOrders,
      pendingTickets,
      pendingReviews,
      humanDriverDistribution,
      recentActions,
    };
  }

  /** 人性驱动分布（选题维度；表未初始化时降级为全 0 分布） */
  async getHumanityDistribution(): Promise<Record<Humanity, number>> {
    const rows = (await Promise.resolve(
      this.ds.query(
        'SELECT human_driver, COUNT(*) as cnt FROM ops_topics WHERE tenant_id = ? AND human_driver IS NOT NULL GROUP BY human_driver',
        [this.tenantId],
      ),
    ).catch(() => [])) as Array<{ human_driver?: unknown; cnt?: unknown }>;
    const distribution: Record<Humanity, number> = {
      贪: 0,
      懒: 0,
      怕: 0,
      虚荣: 0,
      窥探: 0,
      孤独爱: 0,
      愤怒不公: 0,
    };
    (rows ?? []).forEach((row) => {
      const key = row.human_driver as Humanity;
      if (key in distribution) {
        distribution[key] = Number(row.cnt ?? 0);
      }
    });
    return distribution;
  }

  /** 最近操作日志（审计表未初始化时降级为空列表） */
  async getRecentActions(): Promise<
    Array<{ action: string; resource: string; timestamp: string; operator?: string }>
  > {
    const rows = (await Promise.resolve(
      this.ds.query(
        'SELECT action, resource, created_at as timestamp, operator FROM ops_audit_logs WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 20',
        [this.tenantId],
      ),
    ).catch(() => [])) as Array<Record<string, unknown>>;
    return (rows ?? []).map((row) => ({
      action: typeof row.action === 'string' ? row.action : 'unknown',
      resource: typeof row.resource === 'string' ? row.resource : 'unknown',
      timestamp: typeof row.timestamp === 'string' ? row.timestamp : '',
      operator: typeof row.operator === 'string' ? row.operator : undefined,
    }));
  }

  /** 原始行 → 数字字段（缺失/脏值回落 0） */
  private static num(row: Record<string, unknown> | undefined, key: string): number {
    return Number(row?.[key] ?? 0);
  }

  /** 获取技能调用状态 */
  async getSkillStatus(): Promise<{
    totalCalls: number;
    successCalls: number;
    failedCalls: number;
    avgResponseTime: number;
    errorCodes: Record<string, number>;
  }> {
    const raw: unknown = await this.ds.query(
      'SELECT COUNT(*) as total, SUM(CASE WHEN success THEN 1 ELSE 0 END) as success, AVG(response_time) as avg_rt FROM skill_invocation_log WHERE tenant_id = ?',
      [this.tenantId],
    );
    const rows = Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [];
    const first = rows[0];
    const total = DashboardService.num(first, 'total');
    const success = DashboardService.num(first, 'success');
    return {
      totalCalls: total,
      successCalls: success,
      failedCalls: total - success,
      avgResponseTime: DashboardService.num(first, 'avg_rt'),
      errorCodes: {},
    };
  }

  /** 获取平台连接状态 */
  getPlatformStatus(): {
    douyin: boolean;
    wechat: boolean;
    xhs: boolean;
    kuaishou: boolean;
  } {
    const status = {
      douyin: false,
      wechat: false,
      xhs: false,
      kuaishou: false,
    };
    return status;
  }

  /** 待办聚合：发布审核 / 高风客诉 / 对账差异 / 待启动投流（各表未初始化时降级 0） */
  async getTodos(): Promise<{ list: DashboardTodoItem[] }> {
    const toCount = async (
      sql: string,
      params: unknown[],
    ): Promise<{ count: number; latest: string }> => {
      const raw: unknown = await this.ds.query(sql, params).catch(() => []);
      const rows = Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [];
      const count = Number(rows[0]?.cnt ?? 0);
      const latest = typeof rows[0]?.latest === 'string' ? rows[0].latest : '';
      return { count, latest };
    };

    const [publish, cs, reconcile, ad] = await Promise.all([
      toCount(
        'SELECT COUNT(*) as cnt, MAX(id) as latest FROM ops_publish_tasks WHERE tenant_id = ? AND status = ?',
        [this.tenantId, 'pending'],
      ),
      toCount(
        'SELECT COUNT(*) as cnt, MAX(id) as latest FROM ops_support_tickets WHERE tenant_id = ? AND status IN (?, ?) AND priority IN (?, ?)',
        [this.tenantId, 'open', 'pending', 'high', 'urgent'],
      ),
      toCount(
        'SELECT COUNT(*) as cnt, MAX(id) as latest FROM ops_reconciliation WHERE tenant_id = ? AND status = ?',
        [this.tenantId, 'diff_found'],
      ),
      toCount(
        'SELECT COUNT(*) as cnt, MAX(id) as latest FROM ops_ad_campaigns WHERE tenant_id = ? AND status = ?',
        [this.tenantId, 'draft'],
      ),
    ]);

    return {
      list: [
        { type: 'publish', count: publish.count, latest: publish.latest },
        { type: 'cs', count: cs.count, latest: cs.latest },
        { type: 'reconcile', count: reconcile.count, latest: reconcile.latest },
        { type: 'ad', count: ad.count, latest: ad.latest },
      ],
    };
  }

  /** 近 N 日订单趋势（按天聚合，缺失日补 0；表未初始化时降级全 0） */
  async getTrend(days = 10): Promise<{ days: DashboardTrendPoint[] }> {
    const n = Math.min(Math.max(days, 1), 31);
    const raw: unknown = await this.ds
      .query(
        'SELECT DATE_FORMAT(created_at, ?) as date, COUNT(*) as cnt FROM ops_orders WHERE tenant_id = ? AND created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL ? DAY) GROUP BY DATE_FORMAT(created_at, ?)',
        ['%m-%d', this.tenantId, n - 1, '%m-%d'],
      )
      .catch(() => []);
    const map = new Map<string, number>();
    if (Array.isArray(raw)) {
      for (const row of raw as Array<Record<string, unknown>>) {
        if (typeof row.date === 'string') {
          map.set(row.date, Number(row.cnt ?? 0));
        }
      }
    }
    const out: DashboardTrendPoint[] = [];
    const now = new Date();
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const key = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      out.push({ date: key, orders: map.get(key) ?? 0 });
    }
    return { days: out };
  }

  /** 看板配置列表（软删除过滤由 TypeORM 处理） */
  async listConfigs(): Promise<DashboardConfigEntity[]> {
    return this.configRepo.find({ where: { tenantId: this.tenantId } });
  }

  /** 新建看板配置 */
  async createConfig(name: string, widgets: unknown[]): Promise<DashboardConfigEntity> {
    return this.configRepo.save(this.configRepo.create({ tenantId: this.tenantId, name, widgets }));
  }

  /** 更新看板配置（仅本租户可见的记录） */
  async updateConfig(
    id: number,
    name: string,
    widgets: unknown[],
  ): Promise<DashboardConfigEntity | null> {
    const found = await this.configRepo.findOne({ where: { id, tenantId: this.tenantId } });
    if (!found) return null;
    found.name = name;
    found.widgets = widgets;
    return this.configRepo.save(found);
  }

  /** 删除看板配置（软删除；仅本租户） */
  async deleteConfig(id: number): Promise<boolean> {
    const found = await this.configRepo.findOne({ where: { id, tenantId: this.tenantId } });
    if (!found) return false;
    await this.configRepo.softRemove(found);
    return true;
  }
}
