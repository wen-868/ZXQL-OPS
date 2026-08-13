import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// 智享全链运营系统 · 运营后台前端构建配置
// dev 代理：将 /api 转发到本地后端（端口 3100），避免跨域并透传 tenantId 请求头
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    emptyOutDir: false,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3100',
        changeOrigin: true,
        // 仅转发路径，host 改写由 changeOrigin 处理
      },
    },
  },
})
