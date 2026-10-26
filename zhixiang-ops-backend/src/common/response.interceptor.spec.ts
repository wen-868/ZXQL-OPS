import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { ResponseInterceptor } from './response.interceptor';
import { TenantContext } from '../tenant/tenant-context';
import { ApiResponse } from '../shared/response';

/**
 * ResponseInterceptor 统一响应拦截器单测。
 * 覆盖：已是信封（含 code+traceId）原样透传；普通值自动包装为 { code,msg,data,traceId }；
 * traceId 取自 TenantContext，缺省时生成 uuid。
 */

describe('ResponseInterceptor', () => {
  const interceptor = new ResponseInterceptor();

  function callHandlerWith(data: unknown): CallHandler {
    return { handle: () => of(data) };
  }

  async function intercept(data: unknown): Promise<unknown> {
    const obs = interceptor.intercept({} as ExecutionContext, callHandlerWith(data));
    return firstValueFrom(obs);
  }

  it('已是信封（含 code+traceId）→ 原样透传，不二次包装', async () => {
    const envelope: ApiResponse = { code: '0', msg: 'ok', data: null, traceId: 't1' };
    const result = await intercept(envelope);
    expect(result).toBe(envelope);
  });

  it('对象含 code 但缺 traceId → 仍被包装', async () => {
    const result = await TenantContext.run({ traceId: 't1', tenantId: 't1' }, () =>
      intercept({ code: '0', msg: 'x', data: null }),
    );
    expect(result).toMatchObject({ code: '0', msg: '成功', data: { code: '0' }, traceId: 't1' });
  });

  it('普通对象 → 包装为信封，data 保持原值', async () => {
    const result = await intercept({ a: 1 });
    expect(result).toMatchObject({ code: '0', msg: '成功', data: { a: 1 } });
  });

  it('null → 包装，data 为 null', async () => {
    const result = await intercept(null);
    expect(result).toMatchObject({ code: '0', data: null });
  });

  it('undefined → 包装，data 为 null', async () => {
    const result = await intercept(undefined);
    expect(result).toMatchObject({ code: '0', data: null });
  });

  it('TraceId 上下文缺失 → 自动生成 uuid traceId', async () => {
    const result = (await intercept({ b: 2 })) as ApiResponse;
    expect(result.traceId).toEqual(expect.any(String));
    expect(result.traceId.length).toBeGreaterThan(0);
  });

  it('TenantContext 内有 traceId → 包装结果沿用', async () => {
    const result = (await TenantContext.run({ traceId: 'req-9', tenantId: 't1' }, () =>
      intercept({ b: 2 }),
    )) as ApiResponse;
    expect(result.traceId).toBe('req-9');
  });
});
