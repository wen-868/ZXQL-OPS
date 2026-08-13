import { env } from '../config/env';
import { AuthAdapter } from './adapters';
import { verifyMsToken } from './ms-token';

/**
 * 管理系统对接认证适配器（对接方案 §4.2 / §17）。
 * connected 模式下替换 NotImplementedAdapter：
 * - verifyToken：本地验签管理系统 JWT（同一 JWT_SECRET，issuer=zhixiang-system）
 * - ssoLogin：返回管理系统登录页地址（门户跳转登录）
 * - syncTenant / listAccounts：租户同步与账号列表预留（服务账号接入后实现，P3）
 */
export class ConnectedAuthAdapter implements AuthAdapter {
  constructor(private readonly msApiBase: string = env.OPS_MS_API_BASE) {}

  ssoLogin(_tenantId: string): Promise<{ url: string }> {
    return Promise.resolve({ url: `${this.msApiBase}/admin/auth/login` });
  }

  verifyToken(token: string): Promise<{ tenantId: string; userId: number }> {
    const payload = verifyMsToken(token);
    return Promise.resolve({ tenantId: String(payload.tenantId), userId: payload.id });
  }

  syncTenant(_tenantId: string): Promise<void> {
    // 租户映射在 AuthService.sso 内完成（ops_tenant_bind）；
    // 此处预留：服务账号接入后可主动从管理系统拉取租户/门店列表对齐映射。
    return Promise.resolve();
  }

  listAccounts(_tenantId: string): Promise<unknown[]> {
    // P3 服务账号接入后，经管理系统 /api/admin/staff 等接口拉取账号列表。
    return Promise.resolve([]);
  }
}
