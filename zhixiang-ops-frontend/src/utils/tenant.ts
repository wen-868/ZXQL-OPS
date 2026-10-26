// 租户解析：JWT + 租户头由 axios 拦截器注入；SSE（fetch 原生流）不走拦截器，
// AiChatWidget / WorkflowView 等处复用本工具显式携带。
/** 默认租户：dev 从 VITE_TENANT_ID 读取，缺省 t_dev */
const DEFAULT_TENANT_ID = import.meta.env.VITE_TENANT_ID || 't_dev'

/** 当前登录用户租户：优先取 ops_user.tenantId（演示/SSO 账号租户不同），否则回退默认 */
export function currentTenantId(): string {
  try {
    const raw = localStorage.getItem('ops_user')
    if (raw) {
      const user = JSON.parse(raw) as { tenantId?: string } | null
      if (user && user.tenantId) return user.tenantId
    }
  } catch {
    // 解析失败回退默认租户
  }
  return DEFAULT_TENANT_ID
}
