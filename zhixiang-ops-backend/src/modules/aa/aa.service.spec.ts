import { CustomerService } from './aa.service';
import { TenantContext } from '../../tenant/tenant-context';
import type {
  CustomerSessionEntity,
  CustomerMessageEntity,
  SupportTicketEntity,
  KnowledgeEntity,
  CsSettingsEntity,
} from './index';

/** 内存仓库 mock（与项目约定一致：无真实 DB，所有 repo 自维护状态） */
function matchWhere<T extends Record<string, any>>(x: T, where?: Record<string, any>): boolean {
  if (!where) return true;
  return Object.entries(where).every(([k, v]) => v === undefined || x[k] === v);
}
function makeRepo<T extends { id: number; deletedAt?: Date | null }>(items: T[] = []) {
  let seq = items.length ? Math.max(...items.map((i) => i.id)) : 0;
  const arr = items;
  return {
    items: arr,
    create: (p: Partial<T>) => ({ ...(p as object) }) as T,
    save: (e: T) => {
      if (e.id == null) {
        (e as any).id = ++seq;
        arr.push(e);
      } else {
        const i = arr.findIndex((x) => x.id === e.id);
        if (i >= 0) arr[i] = e;
        else arr.push(e);
      }
      return e;
    },
    findOne: (opts: { where?: Record<string, any> } = {}) =>
      arr.find((x) => matchWhere(x, opts.where) && !x.deletedAt) || null,
    find: (opts: { where?: Record<string, any>; order?: Record<string, any> } = {}) =>
      arr.filter((x) => matchWhere(x, opts.where) && !x.deletedAt),
    softRemove: (e: T) => {
      e.deletedAt = new Date();
      return e;
    },
  };
}

const run = <T>(tenantId: string, cb: () => T): T =>
  TenantContext.run({ tenantId, traceId: 'test' }, cb);

describe('CustomerService (AA 智能客服)', () => {
  let svc: CustomerService;
  let sessionRepo: any;
  let messageRepo: any;
  let ticketRepo: any;
  let knowledgeRepo: any;
  let settingsRepo: any;
  let orderSvc: any;
  let productSvc: any;
  let skill: any;
  let audit: any;

  beforeEach(() => {
    sessionRepo = makeRepo<CustomerSessionEntity>();
    messageRepo = makeRepo<CustomerMessageEntity>();
    ticketRepo = makeRepo<SupportTicketEntity>();
    knowledgeRepo = makeRepo<KnowledgeEntity>();
    settingsRepo = makeRepo<CsSettingsEntity>();
    orderSvc = {
      getOrder: jest.fn(async (id: number) => ({
        id,
        orderId: `P-${id}`,
        status: 'paid',
        amount: 100,
        logisticsStatus: 'in_transit',
        productId: 1,
      })),
      getLogisticsTrack: jest.fn(async () => []),
      listOrders: jest.fn(async () => [
        { orderId: 'P-1', status: 'paid', logisticsStatus: 'in_transit' },
      ]),
    };
    productSvc = {
      list: jest.fn(async () => [{ id: 1, title: '测试商品', price: 99, stock: 10 }] as any),
    };
    skill = { generateText: jest.fn(async () => 'AI自动回复内容') };
    audit = { record: jest.fn(async () => undefined) };
    svc = new CustomerService(
      sessionRepo,
      messageRepo,
      ticketRepo,
      knowledgeRepo,
      settingsRepo,
      orderSvc,
      productSvc,
      skill,
      audit,
    );
  });

  it('AA-01 会话创建 + 同买家同渠道复用（不重复）', async () => {
    const r = await run('t1', async () => {
      const s1 = await svc.createSession({
        channel: 'private_dm',
        buyerRef: 'u-99',
      });
      const s2 = await svc.createSession({
        channel: 'private_dm',
        buyerRef: 'u-99',
      });
      const s3 = await svc.createSession({
        channel: 'live_comment',
        buyerRef: 'u-99',
      });
      return { s1, s2, s3 };
    });
    expect(r.s1.id).toBe(r.s2.id); // 复用 open 会话
    expect(r.s3.id).not.toBe(r.s1.id); // 不同渠道新建
  });

  it('AA-02 AI 回复命中知识库（confidence 0.95，不转人工）', async () => {
    const res = await run('t1', async () => {
      await svc.createKnowledge({
        category: 'faq',
        question: '退款政策',
        answer: '7天无理由退款',
      } as any);
      const s = await svc.createSession({
        channel: 'order_message',
        buyerRef: 'u-1',
      });
      return svc.sendMessage(s.id, { content: '退款政策' });
    });
    expect(res.aiReply?.reply).toBe('7天无理由退款');
    expect(res.aiReply?.confidence).toBe(0.95);
    expect(res.aiReply?.transferred).toBe(false);
  });

  it('AA-03 AI 回复走能力网关生成（命中生成，不转人工）', async () => {
    const res = await run('t1', async () => {
      const s = await svc.createSession({
        channel: 'private_dm',
        buyerRef: 'u-2',
      });
      return svc.sendMessage(s.id, { content: '你们家发货快吗' });
    });
    expect(res.aiReply?.reply).toBe('AI自动回复内容');
    expect(skill.generateText).toHaveBeenCalled();
    expect(res.aiReply?.transferred).toBe(false);
  });

  it('AA-04 人工意图 / 低置信度转人工（创建工单 + session.transferred）', async () => {
    const res = await run('t1', async () => {
      const s = await svc.createSession({
        channel: 'private_dm',
        buyerRef: 'u-3',
      });
      return svc.sendMessage(s.id, { content: '转人工' });
    });
    expect(res.aiReply?.intent).toBe('human_handoff');
    expect(res.aiReply?.transferred).toBe(true);
    expect(res.aiReply?.ticketId).not.toBeNull();
    const tickets = await run('t1', async () => svc.listTickets());
    expect(tickets.length).toBe(1);
    expect(tickets[0].status).toBe('open');
  });

  it('AA-05 会话详情含用户消息与 AI 回复消息', async () => {
    const detail = await run('t1', async () => {
      const s = await svc.createSession({
        channel: 'private_dm',
        buyerRef: 'u-4',
      });
      await svc.sendMessage(s.id, { content: '你们家发货快吗' });
      return svc.getSession(s.id);
    });
    expect(detail.messages.length).toBeGreaterThanOrEqual(2); // user + ai
    expect(detail.messages.some((m) => m.role === 'user')).toBe(true);
    expect(detail.messages.some((m) => m.role === 'ai')).toBe(true);
  });

  it('AA-06 知识库 CRUD（create/list/update/delete）', async () => {
    const r = await run('t1', async () => {
      const created = await svc.createKnowledge({
        category: 'product',
        question: '怎么买',
        answer: '点下单',
      } as any);
      const list1 = await svc.listKnowledge();
      const updated = await svc.updateKnowledge(created.id, { answer: '点立即购买' });
      const deleted = await svc.deleteKnowledge(created.id);
      const list2 = await svc.listKnowledge();
      return { created, list1, updated, deleted, list2 };
    });
    expect(r.list1.length).toBe(1);
    expect(r.updated.answer).toBe('点立即购买');
    expect(r.deleted.id).toBe(r.created.id);
    expect(r.list2.length).toBe(0); // 软删后不可见
  });

  it('AA-07 客服设置默认 + upsert', async () => {
    const r = await run('t1', async () => {
      const def = await svc.getSettings();
      const upd = await svc.upsertSettings({
        transferThreshold: 0.9,
        enabledChannels: ['live_comment'],
      } as any);
      const after = await svc.getSettings();
      return { def, upd, after };
    });
    expect(r.def.transferThreshold).toBe(0.5);
    expect(r.def.enabledChannels.length).toBe(4);
    expect(r.upd.transferThreshold).toBe(0.9);
    expect(r.after.enabledChannels).toEqual(['live_comment']);
  });

  it('AA-08 工单解决', async () => {
    const r = await run('t1', async () => {
      const res = await (async () => {
        const s = await svc.createSession({
          channel: 'private_dm',
          buyerRef: 'u-5',
        });
        return svc.sendMessage(s.id, { content: '转人工' });
      })();
      const ticket = await svc.getTicket(res.aiReply!.ticketId!);
      const resolved = await svc.resolveTicket(ticket.id);
      return { ticket, resolved };
    });
    expect(r.ticket.status).toBe('open');
    expect(r.resolved.status).toBe('resolved');
  });

  it('AA-09 同步 R 商品 / Y 订单 知识（added 计数）', async () => {
    const r = await run('t1', async () => {
      const sync = await svc.syncKnowledgeFromRY();
      const list = await svc.listKnowledge();
      return { sync, list };
    });
    expect(r.sync.added).toBe(2); // 1 商品 + 1 订单
    expect(r.list.length).toBe(2);
    expect(r.list.some((k) => k.source === 'sync_r')).toBe(true);
    expect(r.list.some((k) => k.source === 'sync_y')).toBe(true);
  });

  it('AA-10 会话列表按 channel 过滤', async () => {
    const r = await run('t1', async () => {
      await svc.createSession({ channel: 'private_dm', buyerRef: 'u-6' });
      await svc.createSession({ channel: 'live_comment', buyerRef: 'u-6' });
      const all = await svc.listSessions();
      const filtered = await svc.listSessions({ channel: 'live_comment' } as any);
      return { all, filtered };
    });
    expect(r.all.length).toBe(2);
    expect(r.filtered.length).toBe(1);
    expect(r.filtered[0].channel).toBe('live_comment');
  });

  it('AA-11 跨租户隔离（其他租户不可见会话）', async () => {
    await run('t1', async () => {
      await svc.createSession({ channel: 'private_dm', buyerRef: 'u-7' });
    });
    const t2 = await run('t2', async () => svc.listSessions());
    expect(t2.length).toBe(0); // 租户隔离
    const t1 = await run('t1', async () => svc.listSessions());
    expect(t1.length).toBe(1);
  });

  it('AA-12 结构化查询：关联订单的物流/订单状态回复', async () => {
    const res = await run('t1', async () => {
      const s = await svc.createSession({
        channel: 'order_message',
        buyerRef: 'u-8',
        relatedOrderId: 42,
      });
      return svc.sendMessage(s.id, { content: '我的订单到哪了' });
    });
    expect(res.aiReply?.reply).toContain('P-42');
    expect(orderSvc.getOrder).toHaveBeenCalledWith(42);
  });
});
