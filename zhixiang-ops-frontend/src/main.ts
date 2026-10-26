import { createApp } from 'vue'
import { createPinia } from 'pinia'
// Element Plus：组件改为「自动按需」（由 vite.config 的 unplugin-vue-components +
// ElementPlusResolver 在编译期把模板里用到的 el-xxx 重写为子路径导入并带上对应 CSS），
// 故此处不再 app.use(ElementPlus) 全量注册、也不再引全量 index.css（全量约 929KB + 386KB CSS）。
// 全局 locale 改由 App.vue 的 <el-config-provider> 下发（见 App.vue 注释）。
import './styles/variables.css'
import './styles/element-override.css'
import './styles/global.css'
// 按需注册 Element Plus 图标（白名单）。
// 注意：原先 `import * as ElementPlusIconsVue` 全量注册会把 1000+ 图标组件全部打进主包
// （主包因此膨胀到 1.28MB）。全仓实际只用下面这些，且均为「先 import 再以变量绑定」的用法
// （`:icon="Plus"` / `<Fold />`），不依赖全局注册遗漏兜底，故可安全收敛。
// 新增图标时：在此数组补一行即可。
import { Fold, Lock, Key, MagicStick, Plus, User, Warning } from '@element-plus/icons-vue'
import App from './App.vue'
import router from './router'
import { useAppStore } from './stores/app'
import { fetchCsrfToken } from './api/auth'

const app = createApp(App)

// 按需注册白名单图标（见上方 import 说明）
for (const [key, component] of Object.entries({ Fold, Lock, Key, MagicStick, Plus, User, Warning })) {
  app.component(key, component)
}

app.use(createPinia())
app.use(router)
// Element Plus 组件由 unplugin-vue-components 按需引入，无需在此注册

/** C2：已有登录态但缺 CSRF 令牌时（门户 SSO 透传/旧会话）静默补取 */
async function ensureCsrfToken() {
  if (localStorage.getItem('ops_token') && !localStorage.getItem('ops_csrf')) {
    try {
      const { csrfToken } = await fetchCsrfToken()
      localStorage.setItem('ops_csrf', csrfToken)
      useAppStore().setCsrf(csrfToken)
    } catch {
      // 未登录/网络异常静默，后续写请求由后端守卫提示
    }
  }
}

// 统一门户 SSO 注入（P2：门户 iframe 透传运营登录态）
window.addEventListener('message', (event) => {
  const allowedOrigins = ['http://127.0.0.1:8080', 'http://localhost:8080']
  if (!allowedOrigins.includes(event.origin)) return
  const data = event.data
  if (!data || data.type !== 'ops-portal-login' || !data.token) return
  const appStore = useAppStore()
  appStore.setAuth(data.token, data.user)
  if (window.location.pathname === '/login') {
    window.location.href = '/accounts'
  }
  void ensureCsrfToken()
})

app.mount('#app')
void ensureCsrfToken()
