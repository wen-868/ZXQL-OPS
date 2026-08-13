import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { AppError } from '../shared/app-error';
import { traceLogger, alertError } from '../shared/logger';
import { TenantContext } from '../tenant/tenant-context';

/**
 * 全局异常过滤器（对齐管理系统 error-handler 的 { code, msg, data, traceId } 信封）。
 * 捕获 AppError / HttpException / 其它异常，统一输出信封。
 * traceId 取自 TenantContext，与正常响应、日志保持同一链路。
 */

function httpStatusToCode(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return 'INVALID_PARAM';
    case HttpStatus.UNAUTHORIZED:
      return 'UNAUTHORIZED';
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN';
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';
    case HttpStatus.METHOD_NOT_ALLOWED:
      return 'METHOD_NOT_ALLOWED';
    case HttpStatus.CONFLICT:
      return 'CONFLICT';
    case HttpStatus.TOO_MANY_REQUESTS:
      return 'TOO_MANY_REQUESTS';
    case HttpStatus.BAD_GATEWAY:
      return 'EXTERNAL_SERVICE_ERROR';
    case HttpStatus.SERVICE_UNAVAILABLE:
      return 'SERVICE_UNAVAILABLE';
    default:
      return 'INTERNAL_ERROR';
  }
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const traceId = TenantContext.getTraceId() ?? 'unknown';

    let code = 'INTERNAL_ERROR';
    let httpStatus: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '服务器内部错误';
    let data: unknown = null;

    if (exception instanceof AppError) {
      code = exception.code;
      httpStatus = exception.httpStatus;
      message = exception.message;
      data = exception.data;
    } else if (exception instanceof HttpException) {
      httpStatus = exception.getStatus();
      const res = exception.getResponse();
      code = httpStatusToCode(httpStatus);
      message =
        typeof res === 'string'
          ? res
          : ((res as { message?: string }).message ?? exception.message);
      data = typeof res === 'object' ? ((res as { data?: unknown }).data ?? null) : null;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const log = traceLogger(traceId);
    const level = httpStatus >= 500 ? 'error' : 'warn';
    log[level](
      {
        code,
        status: httpStatus,
        path: request.url,
        stack: level === 'error' ? (exception as Error)?.stack : undefined,
      },
      `[${code}] ${message}`,
    );
    if (httpStatus >= 500 && code !== 'EXTERNAL_SERVICE_ERROR') {
      alertError(`[${code}] ${message} traceId=${traceId}`);
    }

    response.status(httpStatus).json({ code, msg: message, data, traceId });
  }
}
