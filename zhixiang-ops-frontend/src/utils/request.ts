import axios, {
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { ElMessage } from 'element-plus'

// 统一响应信封：{ code, msg, data, traceId }
export interface ApiEnvelope<T = unknown> {
  code: string
  msg: string
  data: T
  traceId: string
}

// 成功 code 固定为字符串 "0"
const SUCCESS_CODE = '0'

// 默认租户：dev 从 VITE_TENANT_ID 读取，缺省 t_dev
const DEFAULT_TENANT_ID = import.meta.env.VITE_TENANT_ID || 't_dev'

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
      config.headers['tenantId'] = DEFAULT_TENANT_ID
    }
    // 携带 JWT token
    const token = localStorage.getItem('ops_token')
    if (token && !config.headers['Authorization'] && !config.headers['authorization']) {
      config.headers['Authorization'] = `Bearer ${token}`
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
  (error) => {
    // HTTP 层错误（网络/401/500 等）
    const status = error?.response?.status
    const envelope = error?.response?.data as ApiEnvelope | undefined
    const trace = envelope?.traceId ? `（traceId: ${envelope.traceId}）` : ''
    const msg =
      envelope?.msg || error?.message || '网络异常，请稍后重试'
    if (status === 401) {
      // 清除本地登录态并跳转登录页
      localStorage.removeItem('ops_token')
      localStorage.removeItem('ops_user')
      const currentPath = window.location.pathname
      if (currentPath !== '/login') {
        window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`
      }
      ElMessage.error(`未登录或登录已失效，请重新登录${trace}`)
    } else if (status === 409) {
      ElMessage.error(`${msg}${trace}`)
    } else if (status && status >= 500) {
      ElMessage.error(`服务异常${trace}`)
    } else {
      ElMessage.error(`${msg}${trace}`)
    }
    return Promise.reject(error)
  },
)

export default request
