import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface UserInfo {
  id: number
  username: string
  realName: string
  role: string
  tenantId: string
}

export const useAppStore = defineStore('app', () => {
  // 租户标识
  const tenantId = ref(import.meta.env.VITE_TENANT_ID || 't_dev')
  const sidebarCollapsed = ref(false)

  // 认证状态
  const token = ref(localStorage.getItem('ops_token') || '')
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

  function setAuth(t: string, u: UserInfo) {
    token.value = t
    user.value = u
    localStorage.setItem('ops_token', t)
    localStorage.setItem('ops_user', JSON.stringify(u))
  }

  function clearAuth() {
    token.value = ''
    user.value = null
    localStorage.removeItem('ops_token')
    localStorage.removeItem('ops_user')
  }

  return {
    tenantId,
    sidebarCollapsed,
    token,
    user,
    isLoggedIn,
    toggleSidebar,
    setAuth,
    clearAuth,
  }
})
