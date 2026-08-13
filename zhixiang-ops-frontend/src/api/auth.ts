import request from '@/utils/request'

export interface LoginPayload {
  username: string
  password: string
}

export interface RegisterPayload {
  username: string
  password: string
  realName?: string
}

export interface LoginResult {
  token: string
  user: {
    id: number
    username: string
    realName: string
    role: string
    tenantId: string
  }
}

/** 登录 */
export function login(payload: LoginPayload): Promise<LoginResult> {
  return request.post('/ops/auth/login', payload).then((r) => r.data)
}

/** 注册 */
export function register(payload: RegisterPayload): Promise<LoginResult> {
  return request.post('/ops/auth/register', payload).then((r) => r.data)
}

/** 演示登录：免密进入演示环境（仅演示模式开启时可用） */
export function demoLogin(): Promise<LoginResult> {
  return request.post('/ops/auth/demo-login').then((r) => r.data)
}

/** 获取当前用户信息 */
export function getMe(): Promise<LoginResult['user']> {
  return request.get('/ops/auth/me').then((r) => r.data)
}
