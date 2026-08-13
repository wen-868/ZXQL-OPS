import type { RouteRecordRaw } from 'vue-router'
import BasicLayout from '@/layouts/BasicLayout.vue'
import PlaceholderView from '@/views/PlaceholderView.vue'
import { allMenuPaths, menuGroups } from '@/config/menu'

// 仅这些路径指向真实功能页（已实现模块）
const realPaths: Record<string, () => Promise<unknown>> = {
  '/accounts': () => import('@/views/account/AccountMatrixView.vue'),
  '/intel': () => import('@/views/intel/IntelView.vue'),
  '/analyze': () => import('@/views/analyze/AnalyzeView.vue'),
  '/topic': () => import('@/views/topic/TopicView.vue'),
  '/script': () => import('@/views/script/ScriptView.vue'),
  '/materials': () => import('@/views/materials/MaterialView.vue'),
  '/videos': () => import('@/views/videos/VideoView.vue'),
  '/publish': () => import('@/views/publish/PublishView.vue'),
  '/workflows': () => import('@/views/workflow/WorkflowView.vue'),
  '/recycle': () => import('@/views/recycle/RecycleView.vue'),
  '/selection': () => import('@/views/selection/SelectionView.vue'),
  '/products': () => import('@/views/products/ProductView.vue'),
  '/live': () => import('@/views/live/LiveView.vue'),
  '/ad': () => import('@/views/ad/AdView.vue'),
  '/private': () => import('@/views/private/PrivateView.vue'),
  '/reconcile': () => import('@/views/reconcile/ReconcileView.vue'),
  '/orders': () => import('@/views/orders/OrdersView.vue'),
  '/cs': () => import('@/views/cs/CsView.vue'),
  '/dashboard': () => import('@/views/dashboard/DashboardView.vue'),
  '/talent': () => import('@/views/talent/TalentView.vue'),
  '/global': () => import('@/views/overseas/OverseasView.vue'),
  '/roles': () => import('@/views/team/TeamView.vue'),
  '/compliance': () => import('@/views/compliance/ComplianceView.vue'),
  '/skills': () => import('@/views/skills/SkillsView.vue'),
  '/llm': () => import('@/views/llm/LLMConfigView.vue'),
  '/employees': () => import('@/views/employee/EmployeeView.vue'),
  '/system-init': () => import('@/views/system/SystemInitView.vue'),
  '/integration': () => import('@/views/integration/IntegrationView.vue'),
}

// 真实页路由
const realRoutes: RouteRecordRaw[] = Object.entries(realPaths).map(
  ([path, component]) =>
    ({
      path,
      name: path.replace(/\//g, '') || 'home',
      component: component as RouteRecordRaw['component'],
      meta: { real: true, requiresAuth: true },
    }) as RouteRecordRaw,
)

// 占位页路由（模块建设中）
const placeholderRoutes: RouteRecordRaw[] = allMenuPaths
  .filter((p) => !realPaths[p])
  .map((path) => ({
    path,
    name: path.replace(/\//g, ''),
    component: PlaceholderView,
    meta: { real: false, requiresAuth: true },
  }))

const routes: RouteRecordRaw[] = [
  // 登录页（独立布局，无需认证）
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/auth/LoginView.vue'),
    meta: { requiresAuth: false },
  },
  // 布局容器：所有页面嵌于 左侧菜单 + 顶部栏 + 内容区
  {
    path: '/',
    component: BasicLayout,
    redirect: '/accounts',
    children: [
      // 首页工作台（聚合统计 + 快捷入口）
      {
        path: 'home',
        name: 'home',
        component: () => import('@/views/home/HomeView.vue'),
        meta: { real: true, title: '工作台', requiresAuth: true },
      },
      ...realRoutes,
      ...placeholderRoutes,
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/accounts',
  },
]

// 供菜单渲染使用
export { menuGroups }
export default routes
