import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { fileURLToPath, URL } from 'node:url'

// 智享全链运营系统 · 运营后台前端构建配置
// dev 代理：将 /api 转发到本地后端（端口 3100），避免跨域并透传 tenantId 请求头
export default defineConfig({
  plugins: [
    vue(),
    // Element Plus 自动按需：把模板中用到的 el-xxx 重写为子路径导入 + 对应组件 CSS，
    // 避免全量注册把整个组件库打进包（全量 ~929KB）。
    Components({
      resolvers: [ElementPlusResolver()],
      dts: false, // 不生成 components.d.ts（本项目统一显式 import，避免与 TS 类型源冲突）
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    emptyOutDir: false,
    rollupOptions: {
      output: {
        // 按依赖拆分 vendor：提升长效浏览器缓存命中率（第三方库迭代频率远低于业务代码）。
        // 注意：**不要**把 element-plus 整体归为一个 manualChunk —— 那会把按需引入的
        // 各组件重新合并成一个大包（实测仍 927KB），抵消 unplugin 按需的效果。
        // 交给 Rollup 依组件依赖自然拆分即可。
        manualChunks: {
          vue: ['vue', 'vue-router', 'pinia'],
        },
      },
    },
    // 保持官方默认告警线（500KB）：不靠调高阈值掩盖体积问题，靠真实拆分解决
    chunkSizeWarningLimit: 500,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3100',
        changeOrigin: true,
        // 仅转发路径，host 改写由 changeOrigin 处理
        // ws: 浏览器工作台 WebSocket（/api/browser）随同代理转发
        ws: true,
      },
    },
  },
})
