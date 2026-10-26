import { DataSource } from 'typeorm';
import { DashboardService } from './dashboard.service';
import { TenantContext } from '../../tenant/tenant-context';

/**
 * 运营看板服务测试。
 * mock DataSource.query，覆盖：
 * - 11 路计数全部成功并汇总为 DashboardStats（含直播/订单/工单/复盘）
 * - rows 为空 / cnt 为空时计数按 0 处理
 * - 查询抛错（表尚未初始化）时降级返回 0
 */

function makeService(ds: { query: jest.Mock }): DashboardService {
  return new DashboardService(
    ds as unknown as DataSource,
    {
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      softRemove: jest.fn(),
    } as never,
  );
}

function runWithTenant<T>(fn: () => Promise<T>): Promise<T> {
  return TenantContext.run({ traceId: 't', tenantId: 'tn-1' }, fn);
}

describe('DashboardService', () => {
  let ds: { query: jest.Mock };

  beforeEach(() => {
    ds = { query: jest.fn() };
  });

  it('getStats 汇总 11 路计数', async () => {
    ds.query
      .mockResolvedValueOnce([{ cnt: 3 }]) // accounts
      .mockResolvedValueOnce([{ cnt: 5 }]) // scripts
      .mockResolvedValueOnce([{ cnt: 2 }]) // materials
      .mockResolvedValueOnce([{ cnt: 4 }]) // videos
      .mockResolvedValueOnce([{ cnt: 6 }]) // publishes
      .mockResolvedValueOnce([{ cnt: 1 }]) // topics
      .mockResolvedValueOnce([{ cnt: 7 }]) // intels
      .mockResolvedValueOnce([{ cnt: 2 }]) // liveOnline
      .mockResolvedValueOnce([{ cnt: 284 }]) // todayOrders
      .mockResolvedValueOnce([{ cnt: 8 }]) // pendingTickets
      .mockResolvedValueOnce([{ cnt: 3 }]); // pendingReviews
    const service = makeService(ds);
    const res = await runWithTenant(() => service.getStats());
    expect(res).toEqual({
      accounts: 3,
      scripts: 5,
      materials: 2,
      videos: 4,
      publishes: 6,
      topics: 1,
      intels: 7,
      liveOnline: 2,
      todayOrders: 284,
      pendingTickets: 8,
      pendingReviews: 3,
      humanDriverDistribution: { 贪: 0, 懒: 0, 怕: 0, 虚荣: 0, 窥探: 0, 孤独爱: 0, 愤怒不公: 0 },
      recentActions: [],
    });
    expect(ds.query).toHaveBeenCalledTimes(13);
    // 首批基础表：完整字面量 + 租户占位
    expect(ds.query).toHaveBeenNthCalledWith(
      1,
      'SELECT COUNT(*) as cnt FROM ops_accounts WHERE tenant_id = ?',
      ['tn-1'],
    );
    // 条件计数：仅 ? 占位符，无任何拼接
    expect(ds.query).toHaveBeenNthCalledWith(
      8,
      'SELECT COUNT(*) as cnt FROM ops_live_rooms WHERE tenant_id = ? AND status = ?',
      ['tn-1', 'live'],
    );
    expect(ds.query).toHaveBeenNthCalledWith(
      9,
      'SELECT COUNT(*) as cnt FROM ops_orders WHERE tenant_id = ? AND created_at >= CURRENT_DATE()',
      ['tn-1'],
    );
    expect(ds.query).toHaveBeenNthCalledWith(
      10,
      'SELECT COUNT(*) as cnt FROM ops_support_tickets WHERE tenant_id = ? AND status IN (?, ?)',
      ['tn-1', 'open', 'pending'],
    );
    expect(ds.query).toHaveBeenNthCalledWith(
      11,
      'SELECT COUNT(*) as cnt FROM ops_recycle_tasks WHERE tenant_id = ? AND status IN (?, ?)',
      ['tn-1', 'pending', 'running'],
    );
    // 附加两路：人性分布（ops_topics）与最近操作（ops_audit_logs）
    expect(ds.query).toHaveBeenNthCalledWith(
      12,
      'SELECT human_driver, COUNT(*) as cnt FROM ops_topics WHERE tenant_id = ? AND human_driver IS NOT NULL GROUP BY human_driver',
      ['tn-1'],
    );
    expect(ds.query).toHaveBeenNthCalledWith(
      13,
      'SELECT action, resource, created_at as timestamp, operator FROM ops_audit_logs WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 20',
      ['tn-1'],
    );
  });

  it('rows 为空时计数按 0 处理', async () => {
    ds.query
      .mockResolvedValueOnce([]) // accounts → 0
      .mockResolvedValueOnce([{ cnt: 5 }])
      .mockResolvedValueOnce([{ cnt: 2 }])
      .mockResolvedValueOnce([{ cnt: 4 }])
      .mockResolvedValueOnce([{ cnt: 6 }])
      .mockResolvedValueOnce([{ cnt: 1 }])
      .mockResolvedValueOnce([{ cnt: 7 }])
      .mockResolvedValueOnce([{ cnt: 0 }])
      .mockResolvedValueOnce([{ cnt: 0 }])
      .mockResolvedValueOnce([{ cnt: 0 }])
      .mockResolvedValueOnce([{ cnt: 0 }]);
    const service = makeService(ds);
    const res = await runWithTenant(() => service.getStats());
    expect(res.accounts).toBe(0);
    expect(res.scripts).toBe(5);
    expect(res.liveOnline).toBe(0);
    expect(res.pendingReviews).toBe(0);
  });

  it('cnt 为空时计数按 0 处理', async () => {
    ds.query
      .mockResolvedValueOnce([{ cnt: undefined }]) // accounts → 0
      .mockResolvedValueOnce([{ cnt: 5 }])
      .mockResolvedValueOnce([{ cnt: 2 }])
      .mockResolvedValueOnce([{ cnt: 4 }])
      .mockResolvedValueOnce([{ cnt: 6 }])
      .mockResolvedValueOnce([{ cnt: 1 }])
      .mockResolvedValueOnce([{ cnt: 7 }])
      .mockResolvedValueOnce([{ cnt: undefined }])
      .mockResolvedValueOnce([{ cnt: undefined }])
      .mockResolvedValueOnce([{ cnt: undefined }])
      .mockResolvedValueOnce([{ cnt: undefined }]);
    const service = makeService(ds);
    const res = await runWithTenant(() => service.getStats());
    expect(res.accounts).toBe(0);
    expect(res.scripts).toBe(5);
    expect(res.liveOnline).toBe(0);
    expect(res.todayOrders).toBe(0);
    expect(res.pendingTickets).toBe(0);
    expect(res.pendingReviews).toBe(0);
  });

  it('查询抛错（表未初始化）时降级返回 0', async () => {
    ds.query.mockRejectedValue(new Error('table not exists'));
    const service = makeService(ds);
    const res = await runWithTenant(() => service.getStats());
    expect(res).toEqual({
      accounts: 0,
      scripts: 0,
      materials: 0,
      videos: 0,
      publishes: 0,
      topics: 0,
      intels: 0,
      liveOnline: 0,
      todayOrders: 0,
      pendingTickets: 0,
      pendingReviews: 0,
      humanDriverDistribution: { 贪: 0, 懒: 0, 怕: 0, 虚荣: 0, 窥探: 0, 孤独爱: 0, 愤怒不公: 0 },
      recentActions: [],
    });
  });
});
