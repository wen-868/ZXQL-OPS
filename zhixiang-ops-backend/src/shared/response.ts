import { v4 as uuid } from 'uuid';
import { ERROR_CODES } from './error-code';

/**
 * 统一响应信封（对齐管理系统 backend/src/shared/response.ts 的 ok/err）。
 * 字段顺序固定：code → msg → data → traceId。
 *
 * traceId：优先使用调用方传入的请求级 traceId（来自 TenantContext），
 * 未传时回退新生成，保证一次请求内 interceptor / filter / logger 共用同一 traceId。
 */

export interface ApiResponse<T = unknown> {
  code: string;
  msg: string;
  data: T;
  traceId: string;
}

/** 成功：code = "0" */
export function ok<T>(data?: T, msg = '成功', traceId?: string): ApiResponse<T> {
  return {
    code: '0',
    msg,
    data: (data === undefined ? null : data) as T,
    traceId: traceId ?? uuid(),
  };
}

/** 失败：用字符串错误码查表取默认文案，可被 message 覆盖 */
export function err(
  errorCode: string,
  message?: string,
  data: unknown = null,
  traceId?: string,
): ApiResponse {
  const def = ERROR_CODES[errorCode];
  // 未知错误码回落 INTERNAL_ERROR 文案，与 AppError 共用同一兜底（错误码表为单一真相）
  const msg = message ?? def?.message ?? ERROR_CODES.INTERNAL_ERROR.message;
  return {
    code: errorCode,
    msg,
    data,
    traceId: traceId ?? uuid(),
  };
}
