import { AsyncLocalStorage } from 'async_hooks';
import { AppError } from '../shared/app-error';

/**
 * 请求上下文（对齐管理系统 ai-base 的 TenantContext / AsyncLocalStorage 方案）。
 * 由 TenantMiddleware 在请求开始时 run，挂上 tenantId + traceId，
 * 业务代码通过 current() 读取；一次请求贯穿同一条 traceId，便于全链路追踪。
 */
export interface TenantContextData {
  /** 一次请求唯一追踪号，由中间件生成，interceptor/filter/logger 共用 */
  traceId: string;
  tenantId?: string;
  userId?: number;
  role?: string;
  /** standalone=独立自营；connected=经 ZhixiangCore SSO 打通（规划 §17） */
  type?: string;
  authToken?: string;
}

export class TenantContext {
  private static readonly storage = new AsyncLocalStorage<TenantContextData>();

  /** 在请求作用域内运行回调，ctx 通过 current() 可读 */
  static run<T>(data: TenantContextData, cb: () => T): T {
    return TenantContext.storage.run(data, cb);
  }

  static current(): TenantContextData | undefined {
    return TenantContext.storage.getStore();
  }

  static getTraceId(): string | undefined {
    return TenantContext.storage.getStore()?.traceId;
  }

  static getTenantId(): string | undefined {
    return TenantContext.storage.getStore()?.tenantId;
  }

  static getUserId(): number | undefined {
    return TenantContext.storage.getStore()?.userId;
  }

  /**
   * 强制读取租户标识；缺失即抛 TENANT_REQUIRED。
   * 服务层做数据隔离前的标准入口，避免各模块重复判空。
   */
  static requireTenantId(): string {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) {
      throw new AppError('TENANT_REQUIRED');
    }
    return tenantId;
  }
}
