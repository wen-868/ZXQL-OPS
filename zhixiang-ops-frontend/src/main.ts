import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import './styles/variables.css'
import './styles/element-override.css'
import './styles/global.css'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from './App.vue'
import router from './router'
import { useAppStore } from './stores/app'

const app = createApp(App)

// 注册全部 Element Plus 图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(createPinia())
app.use(router)
app.use(ElementPlus, { locale: zhCn })

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
})

app.mount('#app')
