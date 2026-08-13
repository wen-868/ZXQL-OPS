import { ERROR_CODES } from './error-code';

/**
 * 业务异常（对齐管理系统 backend/src/shared/app-error.ts）。
 * 携带字符串错误码、HTTP 状态、可选附加上下文。
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly httpStatus: number;
  public readonly data: unknown;

  constructor(code: string, message?: string, data: unknown = null) {
    const def = ERROR_CODES[code] ?? ERROR_CODES.INTERNAL_ERROR;
    super(message ?? def.message);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = def.httpStatus;
    this.data = data;
    // 还原原型链（TypeScript 继承 Error 时的固定写法）
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
