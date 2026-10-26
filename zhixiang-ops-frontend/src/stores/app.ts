import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface UserInfo {
  id: number
  username: string
  realName: string
  role: string
  tenantId: string
}

/** 初始租户：优先取已登录用户（演示/SSO 租户不同），否则回退构建时默认 */
function initialTenantId(): string {
  try {
    const raw = localStorage.getItem('ops_user')
    if (raw) {
      const user = JSON.parse(raw) as { tenantId?: string } | null
      if (user && user.tenantId) return user.tenantId
    }
  } catch {
    // 解析失败回退默认
  }
  return import.meta.env.VITE_TENANT_ID || 't_dev'
}

/** 工作区：运营任务页签（G3，任务标签覆盖默认总览） */
export interface WorkspaceTask {
  id: number
  title: string
  status: 'running' | 'pending_confirm' | 'done'
  stepIndex: number
  createdAt: number
}

export const useAppStore = defineStore('app', () => {
  // 租户标识
  const tenantId = ref(initialTenantId())
  const sidebarCollapsed = ref(false)
  // 工作区展开态（原型：收起工作区后 AI 对话区铺满；按钮随状态在 work-top 与 ai-head 间切换）
  const workspaceOpen = ref(true)

  const tasks = ref<WorkspaceTask[]>([])
  const activeTaskId = ref<number | null>(null)
  let taskSeq = 0

  function addTask(title: string): WorkspaceTask {
    const task: WorkspaceTask = {
      id: ++taskSeq,
      title,
      status: 'running',
      stepIndex: 0,
      createdAt: Date.now(),
    }
    tasks.value.push(task)
    // 返回 reactive 代理，调用方修改 task 属性可触发响应（任务步骤/状态联动）
    const proxy = tasks.value[tasks.value.length - 1]
    activeTaskId.value = proxy.id
    return proxy
  }

  function closeTask(id: number) {
    tasks.value = tasks.value.filter((t) => t.id !== id)
    if (activeTaskId.value === id) {
      activeTaskId.value = tasks.value.length ? tasks.value[tasks.value.length - 1].id : null
    }
  }

  function openTask(id: number | null) {
    activeTaskId.value = id
  }

  // AI 对话框外部触发（导航 @AI / 快捷丢任务）
  const aiTask = ref('')
  function askAI(prompt: string) {
    aiTask.value = prompt
  }

  // 认证状态
  const token = ref(localStorage.getItem('ops_token') || '')
  const csrfToken = ref(localStorage.getItem('ops_csrf') || '')
  const user = ref<UserInfo | null>(
    (() => {
      try {
        const raw = localStorage.getItem('ops_user')
        return raw ? JSON.parse(raw) : null
      } catch {
        return null
      }
    })(),
  )

  const isLoggedIn = computed(() => !!token.value)

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  function toggleWorkspace() {
    workspaceOpen.value = !workspaceOpen.value
  }

  function setAuth(t: string, u: UserInfo, csrf?: string) {
    token.value = t
    user.value = u
    if (u?.tenantId) {
      tenantId.value = u.tenantId
    }
    if (csrf) {
      csrfToken.value = csrf
      localStorage.setItem('ops_csrf', csrf)
    }
    localStorage.setItem('ops_token', t)
    localStorage.setItem('ops_user', JSON.stringify(u))
  }

  function setCsrf(csrf: string) {
    csrfToken.value = csrf
    localStorage.setItem('ops_csrf', csrf)
  }

  function clearAuth() {
    token.value = ''
    user.value = null
    csrfToken.value = ''
    localStorage.removeItem('ops_token')
    localStorage.removeItem('ops_user')
    localStorage.removeItem('ops_csrf')
  }

  return {
    tenantId,
    sidebarCollapsed,
    workspaceOpen,
    tasks,
    activeTaskId,
    addTask,
    closeTask,
    openTask,
    aiTask,
    askAI,
    token,
    csrfToken,
    user,
    isLoggedIn,
    toggleSidebar,
    toggleWorkspace,
    setAuth,
    setCsrf,
    clearAuth,
  }
})
