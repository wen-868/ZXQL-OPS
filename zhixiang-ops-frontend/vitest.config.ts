import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

// 前端单测（A3）：核心工具/映射 ≥60% 覆盖率门禁，作为 CI 前端 job 的一部分
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
    env: {
      // 与 DEFAULT_TENANT_ID 缺省值对齐，保证 request 测试确定性
      VITE_TENANT_ID: 't_dev',
      VITE_API_BASE: '/api',
    },
    coverage: {
      provider: 'v8',
      include: [
        'src/utils/format.ts',
        'src/utils/request.ts',
        'src/config/menu.ts',
        'src/views/account/accountMaps.ts',
      ],
      thresholds: {
        statements: 60,
        branches: 60,
        functions: 60,
        lines: 60,
      },
    },
  },
})
