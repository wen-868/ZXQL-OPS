import axios, {
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { ElMessage } from 'element-plus'
import { currentTenantId } from './tenant'

// 统一响应信封：{ code, msg, data, traceId }
export interface ApiEnvelope<T = unknown> {
  code: string
  msg: string
  data: T
  traceId: string
}

// 成功 code 固定为字符串 "0"
const SUCCESS_CODE = '0'

const request: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api',
  timeout: 15000,
})

// 请求拦截器：注入 tenantId + Bearer token
request.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    config.headers = config.headers ?? {}
    // 若业务调用未显式覆盖，则注入默认租户
    if (!config.headers['tenantId'] && !config.headers['tenantid']) {
      config.headers['tenantId'] = currentTenantId()
    }
    // 携带 JWT token
    const token = localStorage.getItem('ops_token')
    if (token && !config.headers['Authorization'] && !config.headers['authorization']) {
      config.headers['Authorization'] = `Bearer ${token}`
    }
    // 携带 CSRF 令牌（C2：写请求防跨站；GET 由后端守卫直放，无令牌不影响）
    const csrf = localStorage.getItem('ops_csrf')
    if (csrf) {
      config.headers['x-csrf-token'] = csrf
    }
    return config
  },
  (error) => Promise.reject(error),
)

// 响应拦截器：统一拆信封。
// 将 response.data 从信封改写为业务 data（envelope.data），调用方 .data 直接为业务 T。
// 通过下方 declare module 把 axios 泛型返回类型收敛为 T。
request.interceptors.response.use(
  (response: AxiosResponse<ApiEnvelope>) => {
    const envelope = response.data
    // 非标准信封（如健康检查明文）直接放行
    if (envelope == null || typeof envelope.code !== 'string') {
      return response
    }
    if (envelope.code === SUCCESS_CODE) {
      // 改写 data 为业务数据，调用方直接消费
      ;(response.data as unknown) = envelope.data
      return response
    }
    // 业务错误：弹窗提示并保留 traceId 便于排查
    const trace = envelope.traceId ? `（traceId: ${envelope.traceId}）` : ''
    ElMessage.error(`${envelope.msg || '请求失败'}${trace}`)
    return Promise.reject(new Error(`[${envelope.code}] ${envelope.msg}${trace}`))
  },
  async (error) => {
    // CSRF 令牌过期（12h TTL）：自动补取新令牌并重试一次，长会话无感自愈
    const e = error as {
      config?: InternalAxiosRequestConfig & { __csrfRetried?: boolean }
      response?: { data?: ApiEnvelope }
    }
    if (e.response?.data?.code === 'CSRF_INVALID' && e.config && !e.config.__csrfRetried) {
      e.config.__csrfRetried = true
      const fresh = await refreshCsrfToken()
      if (fresh) {
        e.config.headers['x-csrf-token'] = fresh
        return request.request(e.config)
      }
    }
    // HTTP 层错误（网络/401/500 等）
    handleResponseError(error)
    return Promise.reject(error)
  },
)

/** 补取 CSRF 令牌（并发去重：同一段时间只发一次刷新请求） */
let csrfRefreshing: Promise<string | null> | null = null
function refreshCsrfToken(): Promise<string | null> {
  if (!csrfRefreshing) {
    csrfRefreshing = axios
      .get<ApiEnvelope<{ csrfToken: string }>>(`${request.defaults.baseURL}/ops/auth/csrf-token`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('ops_token') || ''}`,
          tenantId: currentTenantId(),
        },
        timeout: 15000,
      })
      .then((r) => {
        const token = r.data?.data?.csrfToken
        if (token) localStorage.setItem('ops_csrf', token)
        return token ?? null
      })
      .catch(() => null)
      .finally(() => {
        csrfRefreshing = null
      })
  }
  return csrfRefreshing
}

/** HTTP 错误归一：后端信封优先取 msg/trace，回退原生 message */
function describeHttpError(error: unknown): { status?: number; msg: string; trace: string } {
  const e = error as { response?: { status?: number; data?: ApiEnvelope }; message?: string }
  const status = e.response?.status
  const envelope = e.response?.data
  const trace = envelope?.traceId ? `（traceId: ${envelope.traceId}）` : ''
  const msg = envelope?.msg || e.message || '网络异常，请稍后重试'
  return { status, msg, trace }
}

/** HTTP 层错误统一提示：按状态码分流（401 清登录态跳转，其余弹窗） */
function handleResponseError(error: unknown): void {
  const { status, msg, trace } = describeHttpError(error)
  if (status === 401) {
    handleUnauthorized(trace)
  } else if (status === 409) {
    ElMessage.error(`${msg}${trace}`)
  } else if (status && status >= 500) {
    ElMessage.error(`服务异常${trace}`)
  } else {
    ElMessage.error(`${msg}${trace}`)
  }
}

/** 登录态失效：清除本地凭证并跳转登录页（保留当前路径便于回跳） */
function handleUnauthorized(trace: string): void {
  localStorage.removeItem('ops_token')
  localStorage.removeItem('ops_user')
  localStorage.removeItem('ops_csrf')
  const currentPath = window.location.pathname
  if (currentPath !== '/login') {
    window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`
  }
  ElMessage.error(`未登录或登录已失效，请重新登录${trace}`)
}

export default request
