import { TenantSubscriber } from './tenant.subscriber';
import { TenantContext } from './tenant-context';

/**
 * 租户强隔离订阅器测试。
 * beforeInsert：空 tenantId 自动注入；显式赋值保留；非租户实体跳过。
 * beforeUpdate：禁止跨租户改写（TENANT_MISMATCH）。
 */
describe('TenantSubscriber', () => {
  const sub = new TenantSubscriber();

  const ev = (entity: unknown, dbEntity?: unknown) =>
    ({ entity, databaseEntity: dbEntity }) as never;

  afterEach(() => {
    TenantContext.run({ traceId: 't' }, () => undefined);
  });

  describe('beforeInsert', () => {
    it('tenantId 为空串时从上下文注入', () => {
      TenantContext.run({ traceId: 't', tenantId: 'tn-1' }, () => {
        const e: { tenantId?: string } = { tenantId: '' };
        sub.beforeInsert(ev(e));
        expect(e.tenantId).toBe('tn-1');
      });
    });

    it('tenantId 为 undefined（实体带列但未赋值）时注入', () => {
      TenantContext.run({ traceId: 't', tenantId: 'tn-1' }, () => {
        const e: { tenantId?: string } = { tenantId: undefined };
        sub.beforeInsert(ev(e));
        expect(e.tenantId).toBe('tn-1');
      });
    });

    it('无 tenantId 列的实体（键不存在）安全跳过', () => {
      const e: Record<string, unknown> = { name: 'x' };
      expect(() => sub.beforeInsert(ev(e))).not.toThrow();
      expect('tenantId' in e).toBe(false);
    });

    it('已显式赋值的 tenantId 保留不动', () => {
      TenantContext.run({ traceId: 't', tenantId: 'tn-1' }, () => {
        const e: { tenantId?: string } = { tenantId: 'tn-other' };
        sub.beforeInsert(ev(e));
        expect(e.tenantId).toBe('tn-other');
      });
    });

    it('无实体时安全跳过', () => {
      expect(() => sub.beforeInsert(ev(undefined))).not.toThrow();
    });

    it('无上下文租户时不写入（交由 NOT NULL 约束报错）', () => {
      TenantContext.run({ traceId: 't' }, () => {
        const e: { tenantId?: string } = { tenantId: '' };
        sub.beforeInsert(ev(e));
        expect(e.tenantId).toBe('');
      });
    });
  });

  describe('beforeUpdate', () => {
    it('tenantId 与库中一致时放行', () => {
      expect(() => sub.beforeUpdate(ev({ tenantId: 'tn-1' }, { tenantId: 'tn-1' }))).not.toThrow();
    });

    it('跨租户改写抛 TENANT_MISMATCH', () => {
      expect(() => sub.beforeUpdate(ev({ tenantId: 'tn-2' }, { tenantId: 'tn-1' }))).toThrow(
        '禁止跨租户更新',
      );
    });

    it('无实体 / 无 tenantId / 无库中记录时跳过', () => {
      expect(() => sub.beforeUpdate(ev(undefined))).not.toThrow();
      expect(() => sub.beforeUpdate(ev({}, { tenantId: 'tn-1' }))).not.toThrow();
      expect(() => sub.beforeUpdate(ev({ tenantId: 'tn-1' }, {}))).not.toThrow();
    });
  });
});
