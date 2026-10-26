import { defineConfig } from '@playwright/test'

/**
 * E2E 核心旅程（E6）。
 * 前置：后端已运行于 3100（npm run start，本地 MariaDB/Redis 已起）；
 *      webServer 会自动复用/拉起 vite dev(5173)。
 * 运行：npm run e2e
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      // 后端（内嵌 MySQL 由应用自行拉起）：cwd 必须是后端目录（迁移/二进制按 cwd 解析）
      command: 'node dist/src/main.js',
      cwd: '../zhixiang-ops-backend',
      url: 'http://127.0.0.1:3100/api/ops/health',
      reuseExistingServer: true,
      timeout: 300_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 180_000,
    },
  ],
})
