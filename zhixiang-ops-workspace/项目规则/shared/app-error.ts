/**
 * 业务错误类 — 抛出后由 errorHandler 统一处理
 * 
 * 使用方式：
 *   throw new AppError("订单不存在", 404);
 *   throw new AppError("库存不足", 400);
 * 
 * errorHandler 会识别 statusCode 属性，返回对应状态码和消息
 */
export class AppError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
  }
}