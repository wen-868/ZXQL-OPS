import { FindOptionsWhere } from 'typeorm';
import { applyTenantFilter } from './tenant-base.repository';

/**
 * 读期租户兜底注入器单测（规划 §13）。
 * 覆盖：无上下文不注入 / 有上下文自动注入 / 数组 where 逐项注入 / tenantId:null 显式跳过。
 */
interface Sample {
  tenantId: string;
  status: string;
}

type SampleWhere = FindOptionsWhere<Sample> | FindOptionsWhere<Sample>[] | undefined;

describe('applyTenantFilter', () => {
  it('上下文无 tenantId 时原样返回，不注入', () => {
    const w: SampleWhere = { status: 'active' };
    expect(applyTenantFilter<Sample>(w, undefined)).toEqual({ status: 'active' });
    expect(applyTenantFilter<Sample>([{ status: 'active' }], undefined)).toEqual([
      { status: 'active' },
    ]);
    expect(applyTenantFilter<Sample>(undefined, undefined)).toBeUndefined();
  });

  it('有 tenantId 时向对象 where 自动注入', () => {
    expect(applyTenantFilter<Sample>({ status: 'active' }, 't1')).toEqual({
      status: 'active',
      tenantId: 't1',
    });
  });

  it('有 tenantId 时向数组 where（OR 组）逐项注入', () => {
    expect(applyTenantFilter<Sample>([{ status: 'a' }, { status: 'b' }], 't2')).toEqual([
      { status: 'a', tenantId: 't2' },
      { status: 'b', tenantId: 't2' },
    ]);
  });

  it('显式 tenantId: null 跳过注入并剔除该 key（跨租户/全量查询通道）', () => {
    const w = { status: 'active', tenantId: null } as unknown as FindOptionsWhere<Sample>;
    expect(applyTenantFilter<Sample>(w, 't1')).toEqual({ status: 'active' });
  });

  it('已带其他 tenantId 时强制以上下文为准（防业务误查他人租户）', () => {
    expect(applyTenantFilter<Sample>({ status: 'active', tenantId: 't3' }, 't1')).toEqual({
      status: 'active',
      tenantId: 't1',
    });
  });
});
