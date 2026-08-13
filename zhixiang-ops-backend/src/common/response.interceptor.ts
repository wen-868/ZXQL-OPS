import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ok, ApiResponse } from '../shared/response';
import { TenantContext } from '../tenant/tenant-context';

/**
 * 统一响应拦截器：把控制器返回值包成 { code, msg, data, traceId }。
 * 若返回值本身已是信封（含 code + traceId），原样透传。
 * traceId 取自 TenantContext（一次请求一个），保证与异常过滤器/日志一致。
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data) => {
        const traceId = TenantContext.getTraceId();
        if (
          data &&
          typeof data === 'object' &&
          'code' in (data as object) &&
          'traceId' in (data as object)
        ) {
          return data as ApiResponse;
        }
        return ok(data as unknown, undefined, traceId);
      }),
    );
  }
}
