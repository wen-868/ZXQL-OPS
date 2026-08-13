import { createRouter, createWebHistory } from 'vue-router'
import layoutRoutes from './routes'

const router = createRouter({
  history: createWebHistory(),
  routes: layoutRoutes,
  scrollBehavior: () => ({ top: 0 }),
})

// 全局导航守卫：未登录跳转登录页
router.beforeEach((to) => {
  const token = localStorage.getItem('ops_token')
  // 访问需认证的页面但没有 token → 跳转登录页
  if (to.meta.requiresAuth !== false && !token) {
    return { path: '/login', query: { redirect: to.fullPath }, replace: true }
  }
  // 已登录访问登录页 → 跳转首页
  if (to.path === '/login' && token) {
    return { path: '/accounts', replace: true }
  }
  return true
})

export default router
