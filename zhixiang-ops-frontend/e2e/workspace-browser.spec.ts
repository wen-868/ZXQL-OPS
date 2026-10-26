import { expect, test, type Page } from '@playwright/test'

/**
 * 浏览器工作台 UI 旅程（点击级）：
 * 登录 → 进入工作台 → WS 已连接/执行引擎就绪 → 截图指令 → 画面帧渲染
 * → navigate 指令回填标题 → 人工接管/交还 → 指令队列。
 * 前置：后端 3100（内嵌 MySQL + Playwright 浏览器池）已启动。
 */

async function demoLogin(page: Page): Promise<void> {
  // vite 冷启动/依赖预构建期间首个 goto 可能 ERR_ABORTED，重试兜底
  for (let attempt = 0; ; attempt++) {
    try {
      await page.goto('/login', { waitUntil: 'domcontentloaded' })
      break
    } catch (err) {
      if (attempt >= 2) throw err
      await page.waitForTimeout(3_000)
    }
  }
  await page.getByRole('button', { name: '演示登录（免账号密码）' }).click()
  await page.waitForURL(/\/(accounts|home)/)
}

const CMD_INPUT = /输入指令/

test('工作台：WS 连接 → 截图帧渲染 → 导航 → 接管/交还', async ({ page }) => {
  test.setTimeout(120_000)
  await demoLogin(page)
  await page.goto('/browser-workbench')

  await expect(page.getByText('浏览器工作台', { exact: true })).toBeVisible()
  // 联动面板：WebSocket 已连接 + 执行引擎就绪
  await expect(page.locator('.linkage-item', { hasText: 'WebSocket' })).toContainText('已连接', {
    timeout: 20_000,
  })
  await expect(page.locator('.linkage-item', { hasText: '执行引擎' })).toContainText('就绪')
  // 实时画面：无需任何指令，约 2 秒内自动出现后端截图帧
  const frame = page.locator('img.browser-frame')
  await expect(frame).toBeVisible({ timeout: 20_000 })
  const autoSrc = await frame.getAttribute('src')
  expect(autoSrc).toMatch(/^data:image\/png;base64,/)
  expect((autoSrc || '').length).toBeGreaterThan(10_000)

  // 1) 截图指令 → 画面刷新且计入成功统计（自动帧不计入）
  const input = page.getByPlaceholder(CMD_INPUT)
  await input.fill('screenshot')
  await input.press('Enter')
  await expect(frame).toBeVisible({ timeout: 45_000 })
  const src = await frame.getAttribute('src')
  expect(src).toMatch(/^data:image\/png;base64,/)
  expect((src || '').length).toBeGreaterThan(10_000)
  await expect(page.locator('.info-value.success')).toHaveText('1')

  // 2) navigate 指令 → 地址/标题回填，画面继续刷新
  await input.fill('navigate https://example.com')
  await input.press('Enter')
  await expect(page.locator('.browser-info')).toContainText('Example Domain', { timeout: 60_000 })
  await expect(page.locator('.url-path')).toContainText('example.com')
  await expect(page.locator('.info-value.success')).toHaveText('2')

  // 3) 人工接管 → 横幅 + 人工模式；交还 → 横幅消失
  await page.getByTitle('人工接管').click()
  await expect(page.locator('.takeover-banner')).toContainText('人工接管中')
  await expect(page.locator('.mode-badge')).toHaveText('人工模式')
  await page.getByTitle('交还AI控制').click()
  await expect(page.locator('.takeover-banner')).toBeHidden()
  await expect(page.locator('.mode-badge')).toHaveText('AI模式')

  // 4) 实时画面开关：关闭后画面不再变化，重新开启后恢复刷新
  const srcBeforePause = await frame.getAttribute('src')
  await page.getByTitle(/实时画面：开/).click()
  await expect(page.getByTitle(/实时画面：关/)).toBeVisible()
  await page.waitForTimeout(5_000)
  expect(await frame.getAttribute('src')).toBe(srcBeforePause)
  await page.getByTitle(/实时画面：关/).click()
  await expect(page.getByTitle(/实时画面：开/)).toBeVisible()

  await page.screenshot({ path: 'e2e/shots/workspace-browser.png', fullPage: true })
})

test('工作台：指令队列排队并顺序执行', async ({ page }) => {
  test.setTimeout(120_000)
  await demoLogin(page)
  await page.goto('/browser-workbench')
  await expect(page.locator('.linkage-item', { hasText: 'WebSocket' })).toContainText('已连接', {
    timeout: 20_000,
  })

  const input = page.getByPlaceholder(CMD_INPUT)
  await input.fill('wait 300')
  await page.getByRole('button', { name: '排队' }).click()
  await input.fill('screenshot')
  await page.getByRole('button', { name: '排队' }).click()

  // 两条队列项最终均落定为完成
  await expect(page.locator('.queue-item')).toHaveCount(2)
  await expect(page.locator('.queue-item.done')).toHaveCount(2, { timeout: 60_000 })
  await expect(page.locator('img.browser-frame')).toBeVisible({ timeout: 30_000 })
})

test('工作台 takeover：人工接管真实生效（点击聚焦 + 键盘 Tab/Enter 驱动页面跳转）', async ({ page }) => {
  test.setTimeout(180_000)
  await demoLogin(page)
  await page.goto('/browser-workbench')
  const frame = page.locator('img.browser-frame')
  await expect(frame).toBeVisible({ timeout: 30_000 })

  // 先导航到 example.com（页面内只有一个可聚焦链接 -> Tab/Enter 行为确定）
  const input = page.getByPlaceholder(CMD_INPUT)
  await input.fill('navigate https://example.com')
  await input.press('Enter')
  await expect(page.locator('.browser-info')).toContainText('Example Domain', { timeout: 60_000 })

  // 进入接管：页面绑定 + CDP 输入通道建立
  await page.getByTitle('人工接管').click()
  await expect(page.locator('.takeover-banner')).toContainText('人工接管中')

  // 点击画面中心聚焦（真实鼠标事件经 CDP 注入），再用 Tab 聚焦链接、Enter 激活
  const box = await frame.boundingBox()
  expect(box).not.toBeNull()
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')

  // 若键盘事件真实转发，example.com 的链接会被激活并跳转到 iana.org
  await expect(page.locator('.browser-info')).toContainText(/iana\.org|Internet Assigned Numbers/i, {
    timeout: 60_000,
  })

  await page.getByTitle('交还AI控制').click()
  await expect(page.locator('.takeover-banner')).toBeHidden()
  await page.screenshot({ path: 'e2e/shots/workspace-takeover.png', fullPage: true })
})
