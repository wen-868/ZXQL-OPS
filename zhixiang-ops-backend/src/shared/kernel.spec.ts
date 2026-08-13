import { ok, err, ApiResponse } from './response';
import { AppError } from './app-error';
import { ERROR_CODES } from './error-code';
import { buildPage, pageOffset } from './pagination';
import { TenantContext } from '../tenant/tenant-context';

describe('response 统一响应信封', () => {
  it('ok() 返回成功信封 code=0', () => {
    const r: ApiResponse = ok({ id: 1 }, '好');
    expect(r.code).toBe('0');
    expect(r.msg).toBe('好');
    expect(r.data).toEqual({ id: 1 });
    expect(typeof r.traceId).toBe('string');
    expect(r.traceId.length).toBeGreaterThan(0);
  });

  it('ok() 缺省 data 为 null，msg 默认“成功”', () => {
    const r = ok();
    expect(r.code).toBe('0');
    expect(r.msg).toBe('成功');
    expect(r.data).toBeNull();
  });

  it('ok() 透传调用方传入的 traceId', () => {
    const r = ok(null, '成功', 'trace-xyz');
    expect(r.traceId).toBe('trace-xyz');
  });

  it('err() 用错误码查表取默认文案', () => {
    const r = err('UNAUTHORIZED');
    expect(r.code).toBe('UNAUTHORIZED');
    expect(r.msg).toBe(ERROR_CODES.UNAUTHORIZED.message);
  });

  it('err() 可被 message 覆盖文案，data 透传', () => {
    const r = err('NOT_FOUND', '找不到', { id: 9 });
    expect(r.code).toBe('NOT_FOUND');
    expect(r.msg).toBe('找不到');
    expect(r.data).toEqual({ id: 9 });
  });

  it('err() 未知错误码回落 INTERNAL_ERROR 文案', () => {
    const r = err('__NO_SUCH_CODE__');
    expect(r.code).toBe('__NO_SUCH_CODE__');
    expect(r.msg).toBe(ERROR_CODES.INTERNAL_ERROR.message);
  });
});

describe('AppError 业务异常', () => {
  it('已知错误码映射 httpStatus 与文案', () => {
    const e = new AppError('FORBIDDEN');
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(AppError);
    expect(e.code).toBe('FORBIDDEN');
    expect(e.httpStatus).toBe(403);
    expect(e.message).toBe(ERROR_CODES.FORBIDDEN.message);
    expect(e.name).toBe('AppError');
  });

  it('允许覆盖 message', () => {
    const e = new AppError('INVALID_PARAM', '手机号格式错误');
    expect(e.message).toBe('手机号格式错误');
    expect(e.httpStatus).toBe(400);
  });

  it('未知错误码回落 INTERNAL_ERROR', () => {
    const e = new AppError('UNKNOWN_X');
    expect(e.httpStatus).toBe(500);
    expect(e.code).toBe('UNKNOWN_X');
  });
});

describe('error-code 错误码表', () => {
  it('关键错误码结构完整', () => {
    for (const key of [
      'SUCCESS',
      'INVALID_PARAM',
      'UNAUTHORIZED',
      'FORBIDDEN',
      'NOT_FOUND',
      'INTERNAL_ERROR',
      'TENANT_REQUIRED',
      'ATTRIBUTION_INVALID',
    ]) {
      expect(ERROR_CODES[key]).toBeDefined();
      expect(typeof ERROR_CODES[key].message).toBe('string');
      expect(typeof ERROR_CODES[key].httpStatus).toBe('number');
    }
  });

  it('运营业务错误码存在', () => {
    expect(ERROR_CODES.HUMANITY_INVALID.httpStatus).toBe(400);
    expect(ERROR_CODES.SKILL_UNAVAILABLE.httpStatus).toBe(503);
  });
});

describe('pagination 分页标准', () => {
  it('buildPage 返回稳定结构', () => {
    const p = buildPage([1, 2], 42, 2, 10);
    expect(p).toEqual({ list: [1, 2], total: 42, page: 2, pageSize: 10 });
  });

  it('buildPage 缺省分页参数', () => {
    const p = buildPage([], 0);
    expect(p.page).toBe(1);
    expect(p.pageSize).toBe(20);
  });

  it('pageOffset 正常计算 skip/take', () => {
    expect(pageOffset(3, 20)).toEqual({ skip: 40, take: 20 });
    expect(pageOffset(1, 20)).toEqual({ skip: 0, take: 20 });
  });

  it('pageOffset 防越界：负页→第1页，超页大→封顶200', () => {
    expect(pageOffset(0, 20)).toEqual({ skip: 0, take: 20 });
    expect(pageOffset(-5, 20)).toEqual({ skip: 0, take: 20 });
    expect(pageOffset(1, 9999)).toEqual({ skip: 0, take: 200 });
    expect(pageOffset(1, 0)).toEqual({ skip: 0, take: 1 });
  });
});

describe('TenantContext 请求上下文', () => {
  it('run 作用域内可读，作用域外为空', () => {
    expect(TenantContext.current()).toBeUndefined();
    const result = TenantContext.run({ traceId: 't1', tenantId: 'tn1' }, () => {
      return TenantContext.getTenantId();
    });
    expect(result).toBe('tn1');
    expect(TenantContext.current()).toBeUndefined();
  });

  it('getTraceId 在作用域内可读', () => {
    TenantContext.run({ traceId: 'abc', userId: 7 }, () => {
      expect(TenantContext.getTraceId()).toBe('abc');
      expect(TenantContext.getUserId()).toBe(7);
    });
  });

  it('requireTenantId 缺租户抛 TENANT_REQUIRED', () => {
    expect(() =>
      TenantContext.run({ traceId: 't' }, () => TenantContext.requireTenantId()),
    ).toThrow(AppError);
  });

  it('requireTenantId 有租户返回原值', () => {
    const got = TenantContext.run({ traceId: 't', tenantId: 'tn9' }, () =>
      TenantContext.requireTenantId(),
    );
    expect(got).toBe('tn9');
  });
});
