import { expect, test, type Page } from '@playwright/test'

/**
 * E6 核心旅程：登录 → 总览(真实数据) → AI 流式对话 → 任务批准执行 → 账号矩阵 → 个人中心
 * 前置：后端 3100 已启动（本地 MariaDB + Redis + 智谱网关可用）。
 */

const CHAT_PLACEHOLDER = '丢个运营任务给 AI，Enter 发送'

async function demoLogin(page: Page): Promise<void> {
  await page.goto('/login')
  await page.getByRole('button', { name: '演示登录（免账号密码）' }).click()
  await page.waitForURL(/\/(accounts|home)/)
}

test('旅程1 登录 → 运营总览真实数据渲染（六卡/趋势/待办）', async ({ page }) => {
  await demoLogin(page)
  await page.goto('/home')
  // 六张统计卡（数值来自 /ops/dashboard/stats）
  await expect(page.locator('.card')).toHaveCount(6)
  // 趋势图真实柱（/ops/dashboard/trend）
  await expect(page.locator('.chart .bar')).not.toHaveCount(0)
  // 待办四类（/ops/dashboard/todos 聚合）
  await expect(page.getByRole('button', { name: /发布审核/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /高风客诉/ })).toBeVisible()
})

test('旅程2 AI 对话流式回复（真实 LLM）', async ({ page }) => {
  await demoLogin(page)
  await page.goto('/home')
  const input = page.getByPlaceholder(CHAT_PLACEHOLDER)
  await input.fill('用一句话介绍选题中心')
  await input.press('Enter')
  // 等真实 LLM 回复出现（SSE 流式分段到达）
  await expect(page.locator('.msg.ai').last()).toContainText(/选题/, { timeout: 30_000 })
})

test('旅程3 任务批准 → 真实自动化链产物卡', async ({ page }) => {
  // 真实 LLM 回复 + 8 段链执行，总时长可能数分钟
  test.setTimeout(300_000)
  await demoLogin(page)
  await page.goto('/home')
  const input = page.getByPlaceholder(CHAT_PLACEHOLDER)
  await input.fill('给红星商行做条五粮液短视频挂车卖')
  await input.press('Enter')
  // 任务页签 + 确认卡出现
  await expect(page.getByRole('button', { name: /批准执行/ })).toBeVisible({ timeout: 120_000 })
  await page.getByRole('button', { name: '批准执行' }).click()
  // 真实 8 段链结果流入（工具日志 ok 行）
  await expect(page.locator('.toollog .ok').first()).toBeVisible({ timeout: 90_000 })
  // 批准后产物卡网格（真实产物计数）
  await expect(page.locator('.products .prod')).toHaveCount(5, { timeout: 120_000 })
})

test('旅程4 账号矩阵真实数据', async ({ page }) => {
  await demoLogin(page)
  await page.goto('/accounts')
  await expect(page.getByRole('button', { name: '新建账号' })).toBeVisible()
  // 演示种子 5 个账号（抖音/快手/B站/小红书/视频号）
  await expect(page.locator('.el-table__row')).toHaveCount(5, { timeout: 15_000 })
})

test('旅程5 个人中心租户信息', async ({ page }) => {
  await demoLogin(page)
  await page.goto('/profile')
  await expect(page.getByRole('heading', { name: '个人中心 / 租户信息' })).toBeVisible()
  await expect(page.getByText('12/30（已用/总额）')).toBeVisible()
  await expect(page.getByText('Hy3（本地 Ollama · qwen2.5:7b）')).toBeVisible()
})
