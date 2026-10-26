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

/** HTTP 状态码 → 业务错误码映射表（Map 查找，switch 的 11 分支归一为 1） */
const HTTP_STATUS_CODE_MAP: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'INVALID_PARAM',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'INVALID_PARAM',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.METHOD_NOT_ALLOWED]: 'METHOD_NOT_ALLOWED',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  [HttpStatus.BAD_GATEWAY]: 'EXTERNAL_SERVICE_ERROR',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
};

function httpStatusToCode(status: number): string {
  return HTTP_STATUS_CODE_MAP[status] ?? 'INTERNAL_ERROR';
}

/** 异常 → 响应字段映射（AppError / HttpException / 普通 Error / 未知） */
function describeException(exception: unknown): {
  code: string;
  httpStatus: number;
  message: string;
  data: unknown;
} {
  if (exception instanceof AppError) {
    return {
      code: exception.code,
      httpStatus: exception.httpStatus,
      message: exception.message,
      data: exception.data,
    };
  }
  if (exception instanceof HttpException) {
    const httpStatus = exception.getStatus();
    const res = exception.getResponse();
    return {
      code: httpStatusToCode(httpStatus),
      httpStatus,
      message:
        typeof res === 'string'
          ? res
          : ((res as { message?: string }).message ?? exception.message),
      data: typeof res === 'object' ? ((res as { data?: unknown }).data ?? null) : null,
    };
  }
  if (exception instanceof Error) {
    return {
      code: 'INTERNAL_ERROR',
      httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
      message: exception.message,
      data: null,
    };
  }
  return {
    code: 'INTERNAL_ERROR',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
    message: '服务器内部错误',
    data: null,
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const traceId = TenantContext.getTraceId() ?? 'unknown';
    const { code, httpStatus, message, data } = describeException(exception);

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
