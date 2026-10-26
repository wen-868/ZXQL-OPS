import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('element-plus', () => ({
  ElMessage: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}))

import { ElMessage } from 'element-plus'
import request from './request'

type Handler = { fulfilled: (arg: unknown) => unknown; rejected: (arg: unknown) => unknown }

describe('utils/request 拦截器', () => {
  let requestHandlers: Handler[]
  let responseHandlers: Handler[]

  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    // 用可写 stub 替代 jsdom location，避免 401 重定向触发 "Not implemented: navigation"
    Object.defineProperty(window, 'location', {
      value: { pathname: '/orders', href: '' },
      configurable: true,
      writable: true,
    })
    requestHandlers = (request.interceptors.request as unknown as { handlers: Handler[] }).handlers
    responseHandlers = (request.interceptors.response as unknown as { handlers: Handler[] }).handlers
  })

  it('请求拦截器注入租户头 + Bearer token + CSRF 头', () => {
    localStorage.setItem('ops_user', JSON.stringify({ tenantId: 't_demo' }))
    localStorage.setItem('ops_token', 'jwt-token')
    localStorage.setItem('ops_csrf', 'csrf-abc')
    const cfg = requestHandlers[0].fulfilled({ headers: {} }) as Record<string, Record<string, string>>
    expect(cfg.headers['tenantId']).toBe('t_demo')
    expect(cfg.headers['Authorization']).toBe('Bearer jwt-token')
    expect(cfg.headers['x-csrf-token']).toBe('csrf-abc')
  })

  it('已显式设置的头不覆盖；无 token 时不注入 Authorization', () => {
    localStorage.clear()
    const cfg = requestHandlers[0].fulfilled({
      headers: { tenantId: 'explicit', Authorization: 'Bearer custom' },
    }) as Record<string, Record<string, string>>
    expect(cfg.headers['tenantId']).toBe('explicit')
    expect(cfg.headers['Authorization']).toBe('Bearer custom')
  })

  it('ops_user 非法 JSON 时回退默认租户', () => {
    localStorage.setItem('ops_user', 'not-json{')
    const cfg = requestHandlers[0].fulfilled({ headers: {} }) as Record<string, Record<string, string>>
    expect(cfg.headers['tenantId']).toBe('t_dev')
  })

  it('响应拦截器成功信封改写 data 为业务数据', () => {
    const res = responseHandlers[0].fulfilled({
      data: { code: '0', msg: 'ok', data: { a: 1 }, traceId: 'tr1' },
    }) as { data: unknown }
    expect(res.data).toEqual({ a: 1 })
  })

  it('非标准信封（如健康检查）直接放行', () => {
    expect((responseHandlers[0].fulfilled({ data: 'pong' }) as { data: unknown }).data).toBe('pong')
    expect((responseHandlers[0].fulfilled({ data: null }) as { data: unknown }).data).toBeNull()
  })

  it('业务错误信封弹窗并 reject', async () => {
    const res = responseHandlers[0].fulfilled({
      data: { code: 'E_BUSY', msg: '系统忙', data: null, traceId: 'tr9' },
    })
    await expect(res).rejects.toThrow('[E_BUSY] 系统忙（traceId: tr9）')
    expect(ElMessage.error).toHaveBeenCalledTimes(1)
    expect((ElMessage.error as unknown as { mock: { calls: Array<Array<string>> } }).mock.calls[0][0]).toContain(
      '系统忙',
    )
  })

  it('HTTP 401 清除本地登录态并提示', async () => {
    localStorage.setItem('ops_token', 'x')
    localStorage.setItem('ops_user', 'y')
    localStorage.setItem('ops_csrf', 'z')
    const err = { response: { status: 401, data: { msg: '未登录', traceId: 'tr401' } } }
    await expect(responseHandlers[0].rejected(err)).rejects.toBe(err)
    expect(localStorage.getItem('ops_token')).toBeNull()
    expect(localStorage.getItem('ops_user')).toBeNull()
    expect(localStorage.getItem('ops_csrf')).toBeNull()
    expect(ElMessage.error).toHaveBeenCalledWith(expect.stringContaining('未登录'))
  })

  it('HTTP 409 / 5xx / 400 / 网络错误分别提示', async () => {
    const swallow = async (p: unknown): Promise<void> => {
      try {
        await Promise.resolve(p)
      } catch {
        // 消费拦截器返回的拒绝，避免未处理拒绝
      }
    }

    await swallow(responseHandlers[0].rejected({ response: { status: 409, data: { msg: '冲突' } } }))
    expect(ElMessage.error).toHaveBeenCalledWith(expect.stringContaining('冲突'))

    vi.clearAllMocks()
    await swallow(
      responseHandlers[0].rejected({ response: { status: 503, data: { traceId: 'tr503' } } }),
    )
    expect(ElMessage.error).toHaveBeenCalledWith(expect.stringContaining('服务异常（traceId: tr503）'))

    vi.clearAllMocks()
    await swallow(
      responseHandlers[0].rejected({ response: { status: 400, data: { msg: '参数错误' } } }),
    )
    expect(ElMessage.error).toHaveBeenCalledWith(expect.stringContaining('参数错误'))

    vi.clearAllMocks()
    await expect(responseHandlers[0].rejected({ message: 'Network Error' })).rejects.toEqual({
      message: 'Network Error',
    })
    expect(ElMessage.error).toHaveBeenCalledWith(expect.stringContaining('Network Error'))
  })
})
