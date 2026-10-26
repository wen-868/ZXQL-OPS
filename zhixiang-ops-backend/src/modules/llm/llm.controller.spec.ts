import { LlmController } from './llm.controller';
import { TenantContext } from '../../tenant/tenant-context';

describe('LlmController', () => {
  let controller: LlmController;
  let svc: { [k: string]: jest.Mock };

  beforeEach(() => {
    svc = {
      list: jest.fn(),
      detail: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      testConnection: jest.fn(),
    };
    controller = new LlmController(svc as any);
  });

  it('list 读取租户上下文并原样返回', async () => {
    const q = { page: 1 } as any;
    svc.list.mockResolvedValue({ items: [] });
    const r = await TenantContext.run({ traceId: 't-c1', tenantId: 'tn-1' }, () =>
      controller.list(q),
    );
    expect(r).toEqual({ items: [] });
    expect(svc.list).toHaveBeenCalledWith(q, 'tn-1');
  });

  it('detail 直接透传数字 id 并读取租户上下文', async () => {
    svc.detail.mockResolvedValue({ id: 2 });
    const r = await TenantContext.run({ traceId: 't-c2', tenantId: 'tn-1' }, () =>
      controller.detail(2),
    );
    expect(r).toEqual({ id: 2 });
    expect(svc.detail).toHaveBeenCalledWith(2, 'tn-1');
  });

  it('create 委托 svc.create 并读取租户上下文', async () => {
    const dto = { provider: 'openai' } as any;
    svc.create.mockResolvedValue({ id: 3 });
    const r = await TenantContext.run({ traceId: 't-c3', tenantId: 'tn-1' }, () =>
      controller.create(dto),
    );
    expect(r).toEqual({ id: 3 });
    expect(svc.create).toHaveBeenCalledWith(dto, 'tn-1');
  });

  it('update 直接透传数字 id 并读取租户上下文', async () => {
    const dto = { apiKey: 'k' } as any;
    svc.update.mockResolvedValue({ id: 4 });
    const r = await TenantContext.run({ traceId: 't-c4', tenantId: 'tn-1' }, () =>
      controller.update(4, dto),
    );
    expect(r).toEqual({ id: 4 });
    expect(svc.update).toHaveBeenCalledWith(4, dto, 'tn-1');
  });

  it('remove 直接透传数字 id 并读取租户上下文', async () => {
    svc.remove.mockResolvedValue({ removed: true });
    const r = await TenantContext.run({ traceId: 't-c5', tenantId: 'tn-1' }, () =>
      controller.remove(5),
    );
    expect(r).toEqual({ removed: true });
    expect(svc.remove).toHaveBeenCalledWith(5, 'tn-1');
  });

  it('test 直接透传数字 id 并读取租户上下文', async () => {
    svc.testConnection.mockResolvedValue({ ok: true });
    const r = await TenantContext.run({ traceId: 't-c6', tenantId: 'tn-1' }, () =>
      controller.test(6),
    );
    expect(r).toEqual({ ok: true });
    expect(svc.testConnection).toHaveBeenCalledWith(6, 'tn-1');
  });
});
