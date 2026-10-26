import { BaseEntity } from './base.entity';
import { TenantContext } from '../tenant/tenant-context';

/**
 * 实体基类测试：tenantId 自动注入钩子。
 * BeforeInsert 语义：为空时从上下文注入；显式赋值保留；无上下文时交由 NOT NULL 报错。
 */
describe('BaseEntity', () => {
  class FakeEntity extends BaseEntity {
    fill(): void {
      // @BeforeInsert 钩子在测试中手动触发（保护方法经子类桥接调用）
      this['fillTenantId']();
    }
  }

  it('tenantId 为空且上下文有租户 → 注入', () => {
    TenantContext.run({ traceId: 't', tenantId: 'tn-1' }, () => {
      const e = new FakeEntity();
      e.fill();
      expect(e.tenantId).toBe('tn-1');
    });
  });

  it('tenantId 已显式赋值 → 保留', () => {
    TenantContext.run({ traceId: 't', tenantId: 'tn-1' }, () => {
      const e = new FakeEntity();
      e.tenantId = 'tn-explicit';
      e.fill();
      expect(e.tenantId).toBe('tn-explicit');
    });
  });

  it('上下文无租户 → 不写空（交由 NOT NULL 约束报错）', () => {
    TenantContext.run({ traceId: 't' }, () => {
      const e = new FakeEntity();
      e.fill();
      expect(e.tenantId).toBeUndefined();
    });
  });
});
