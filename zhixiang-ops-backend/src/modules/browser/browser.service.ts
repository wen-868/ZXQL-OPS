import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { env } from '../../config/env';
import type { SnapshotDto } from './browser.dto';

/**
 * AI 页面观察（浏览器快照）服务。
 *
 * 定位：给 AI 对话一条「看一眼当前页面」的能力——用独立的无头 Chromium
 * 打开前端应用（demo 登录），截图 + 关键 DOM 摘要回传。AI 依据文本摘要
 * 核实任务结果，人工在对话里看截图。第三方平台自动化属后续阶段，不在此列。
 *
 * 浏览器为懒加载单例；快照目标基址/无头/可执行路径均可经 env 覆盖。
 */
@Injectable()
export class BrowserService implements OnModuleDestroy {
  private readonly logger = new Logger(BrowserService.name);
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private ready = false;
  private starting: Promise<void> | null = null;

  private get base(): string {
    return env.OPS_BROWSER_BASE || 'http://localhost:5173';
  }

  private resolveExecutable(): string {
    if (env.OPS_BROWSER_EXECUTABLE) return env.OPS_BROWSER_EXECUTABLE;
    // 复用 Playwright E2E 已下载的 chromium（本机 ms-playwright 缓存）
    const candidates = [
      join(
        homedir(),
        'AppData',
        'Local',
        'ms-playwright',
        'chromium-1243',
        'chrome-win64',
        'chrome.exe',
      ),
      join(
        homedir(),
        'AppData',
        'Local',
        'ms-playwright',
        'chromium-1243',
        'chrome-win',
        'chrome.exe',
      ),
    ];
    const hit = candidates.find((p) => existsSync(p));
    if (hit) return hit;
    throw new Error(
      '未找到 Chromium 可执行文件：请先运行 npx playwright install chromium 或配置 OPS_BROWSER_EXECUTABLE',
    );
  }

  /** 懒加载单例：并发快照共享同一浏览器会话（含登录态），失败可重入 */
  private async start(): Promise<void> {
    if (this.ready) return;
    if (!this.starting) {
      this.starting = this.boot();
    }
    await this.starting;
  }

  private async boot(): Promise<void> {
    try {
      const executablePath = this.resolveExecutable();
      this.logger.log(`启动 Chromium（${executablePath}，headless=${env.OPS_BROWSER_HEADLESS}）`);
      this.browser = await chromium.launch({
        executablePath,
        headless: env.OPS_BROWSER_HEADLESS,
        args: ['--no-sandbox'],
      });
      this.context = await this.browser.newContext({
        viewport: { width: 1440, height: 900 },
        locale: 'zh-CN',
      });
      this.page = await this.context.newPage();
      await this.relogin();
      this.ready = true;
      this.logger.log('浏览器会话就绪（已演示登录）');
    } finally {
      this.starting = null;
    }
  }

  /** 演示登录：未登录状态一律回到登录页点「演示登录」 */
  private async relogin(): Promise<void> {
    if (!this.page) throw new Error('浏览器未就绪');
    const page = this.page;
    await page
      .goto(`${this.base}/login`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
      .catch(() => {});
    const demoBtn = page.getByRole('button', { name: '演示登录（免账号密码）' });
    await demoBtn.waitFor({ timeout: 15_000 });
    await demoBtn.click();
    await page.waitForURL(/\/(accounts|home)/, { timeout: 25_000 });
  }

  /** 会话状态（用于前端展示「页面观察」可用性） */
  state() {
    return {
      ready: this.ready,
      base: this.base,
      headless: env.OPS_BROWSER_HEADLESS,
      url: this.page ? this.page.url() : null,
    };
  }

  private targetUrl(dto: SnapshotDto): string {
    // path 强制以 / 开头（拼在固定 base 后，无法改写主机）
    const path = dto.path && dto.path.startsWith('/') ? dto.path : '/home';
    let query = '';
    if (dto.query) {
      // query 白名单字符消毒：拒绝控制字符/空白/引号/井号，
      // 防止 HTTP 头注入、路由劫持与 base+query 拼装时的协议切换
      if (!/^[A-Za-z0-9!$'()*+,.\/:;=@_%~[\]-]+$/.test(dto.query) || dto.query.length > 1024) {
        throw new Error('snapshot.query 含非法字符');
      }
      query = `?${dto.query}`;
    }
    return `${this.base}${path}${query}`;
  }

  /** 仅导航（保持会话/预热页面），不截图 */
  async navigate(dto: SnapshotDto) {
    await this.start();
    if (!this.page) throw new Error('浏览器未就绪');
    const url = this.targetUrl(dto);
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await this.page.waitForTimeout(500);
    await this.ensureAuthed(dto);
    return { url: this.page.url() };
  }

  /** 截图 + 关键 DOM 摘要 */
  async snapshot(dto: SnapshotDto) {
    await this.start();
    if (!this.page) throw new Error('浏览器未就绪');
    const url = this.targetUrl(dto);
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await this.page.waitForTimeout(700); // SPA 渲染稳定
    await this.ensureAuthed(dto);
    // 等待真实页内容而非占位
    const summary = await this.page.evaluate(this.extractSummary);
    const screenshot = await this.page.screenshot({ type: 'png' });
    return {
      url: this.page.url(),
      title: await this.page.title(),
      screenshot: `data:image/png;base64,${screenshot.toString('base64')}`,
      summary,
    };
  }

  /** 若被踢回登录页（会话过期）→ 重新登录并回到目标页 */
  private async ensureAuthed(dto: SnapshotDto): Promise<void> {
    if (!this.page) return;
    if (this.page.url().includes('/login')) {
      await this.relogin();
      const url = this.targetUrl(dto);
      await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await this.page.waitForTimeout(700);
    }
  }

  /** 在目标页求值：标题/标题头/表格行/总览卡/待办/按钮/消息，供 AI 核实 */
  private extractSummary(): Record<string, unknown> {
    const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
    const text = (el: Element | null) => clean(el?.textContent ?? '');
    const cap = (arr: (string | null)[], n: number) =>
      arr.filter((x): x is string => !!x && x.length > 0).slice(0, n);

    const headings = cap(
      Array.from(document.querySelectorAll('h1,h2,h3')).map((el) => {
        const t = text(el);
        return t.length < 80 ? t : null;
      }),
      8,
    );

    const rows = Array.from(document.querySelectorAll('.el-table__row'));
    const table = {
      rows: rows.length,
      sample: cap(
        rows.map((r) =>
          Array.from(r.querySelectorAll('td'))
            .map((td) => text(td))
            .join(' | '),
        ),
        5,
      ),
    };

    const cards = cap(
      Array.from(document.querySelectorAll('.card')).map((c) => {
        const k = c.querySelector('.k');
        const v = c.querySelector('.v');
        return k && v ? `${text(k)}：${text(v)}` : null;
      }),
      12,
    );

    const todos = cap(
      Array.from(document.querySelectorAll('.todo .item')).map((el) => text(el)),
      6,
    );

    const buttons = cap(
      Array.from(document.querySelectorAll('button'))
        .map((el) => text(el))
        .filter((t) => t.length <= 16),
      10,
    );

    const messages = cap(
      Array.from(document.querySelectorAll('.el-message')).map((el) => text(el)),
      3,
    );

    const bodyText = document.body ? clean(document.body.innerText) : '';
    return {
      url: location.pathname + location.search,
      title: document.title,
      headings,
      table,
      cards,
      todos,
      buttons,
      messages,
      hasContent: bodyText.length > 40,
    };
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.browser?.close();
    } catch {
      // 忽略关闭异常
    }
    this.browser = null;
    this.context = null;
    this.page = null;
    this.ready = false;
  }
}
