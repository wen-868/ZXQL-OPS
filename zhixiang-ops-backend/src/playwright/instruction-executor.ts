import { Instruction, InstructionType, validateInstruction } from './directive-parser';
import type { Page } from 'playwright';
import { errMessage } from './err-msg';

export interface ExecuteResult {
  success: boolean;
  error?: string;
  screenshot?: string; // base64 encoded
  /** 执行结束后的页面地址（由执行上下文回填） */
  url?: string;
  /** 执行结束后的页面标题 */
  title?: string;
  readonly duration: number;
  readonly retryCount: number;
}

interface StepResult {
  success: boolean;
  error?: string;
  screenshot?: string;
}

export class InstructionExecutor {
  private maxRetries: number;
  private retryDelay: number;
  private executionHistory: Array<{
    instruction: Instruction;
    success: boolean;
    error?: string;
    timestamp: number;
  }> = [];

  constructor(maxRetries: number = 3, retryDelay: number = 1000) {
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
  }

  /** 兼容适配器 init() 调用（无需真实初始化） */
  async init(): Promise<void> {
    /* no-op：执行器无外部资源 */
  }

  /**
   * 执行指令序列（page 为 Playwright Page 实例）
   * onRetry：单条指令发生重试时回调（供 WS 网关实时通知前端）
   */
  /**
   * 执行指令序列（page 为 Playwright Page 实例）
   * onRetry：单条指令发生重试时回调（供 WS 网关实时通知前端）
   */
  async executeSequence(
    instructions: Instruction[],
    page: Page,
    onRetry?: (attempt: number) => void,
  ): Promise<ExecuteResult> {
    const startTime = Date.now();
    let lastError: string | undefined;
    let totalRetries = 0;
    let lastScreenshot: string | undefined;

    for (const instruction of instructions) {
      if (!validateInstruction(instruction)) {
        lastError = `无效的指令格式: ${instruction.payload}`;
        this.recordHistory(instruction, false, lastError);
        break; // 单条失败即中断序列
      }

      const step = await this.runWithRetry(page, instruction, onRetry);
      totalRetries += step.retriesUsed;
      if (step.result.screenshot) lastScreenshot = step.result.screenshot;
      this.recordHistory(instruction, step.result.success, step.result.error);

      if (!step.result.success) {
        lastError = step.result.error || '指令执行失败';
        break; // 单条失败即中断序列
      }
    }

    // 回填当前页面地址与标题（供工作台状态栏展示；页面可能已关闭，失败静默）
    const { url, title } = await this.readPageState(page);

    return {
      success: lastError === undefined,
      error: lastError,
      screenshot: lastScreenshot,
      url,
      title,
      duration: Date.now() - startTime,
      retryCount: totalRetries,
    };
  }

  /** 记录执行历史（统一入口，避免调用点重复拼装） */
  private recordHistory(instruction: Instruction, success: boolean, error?: string): void {
    this.executionHistory.push({
      instruction,
      success,
      error,
      timestamp: Date.now(),
    });
  }

  /**
   * 带重试执行单条指令：可重试错误（timeout/network 等）按指数退避重试，
   * 不可重试错误立即短路；返回实际使用次数。
   */
  private async runWithRetry(
    page: Page,
    instruction: Instruction,
    onRetry?: (attempt: number) => void,
  ): Promise<{ result: StepResult; retriesUsed: number }> {
    for (let attempt = 0; ; attempt++) {
      const stepResult = await this.attemptStep(page, instruction);
      // 成功 / 不可重试 / 已用尽次数 → 结束
      if (stepResult.success) {
        return { result: stepResult, retriesUsed: attempt };
      }
      const error = stepResult.error ?? '';
      if (!this.isRetryableError(error) || attempt >= this.maxRetries) {
        return { result: stepResult, retriesUsed: attempt };
      }
      const backoff = Math.min(this.retryDelay * Math.pow(1.5, attempt), 5000);
      await new Promise((r) => setTimeout(r, backoff));
      onRetry?.(attempt + 1);
    }
  }

  /** 单次执行尝试：异常统一收敛为失败结果（供重试循环判定） */
  private async attemptStep(page: Page, instruction: Instruction): Promise<StepResult> {
    try {
      return await this.executeSingleInstruction(page, instruction);
    } catch (err: unknown) {
      return { success: false, error: errMessage(err) || '执行异常' };
    }
  }

  /** 读取页面当前 url/title（页面可能已关闭，失败静默兜底） */
  private async readPageState(page: Page): Promise<{ url?: string; title?: string }> {
    try {
      return { url: page.url(), title: await page.title() };
    } catch {
      return {};
    }
  }

  /**
   * 分发单条指令（page: Playwright Page）
   */
  private async executeSingleInstruction(
    page: Page,
    instruction: Instruction,
  ): Promise<StepResult> {
    const { type, payload } = instruction;
    switch (type) {
      case InstructionType.Navigate: {
        // payload: "navigate <url>"
        const url = payload.replace(/^navigate\s+/i, '').trim();
        return this.executeNavigate(page, url);
      }
      case InstructionType.Click: {
        const selector = payload.replace(/^click\s+/i, '').trim();
        return this.executeClick(page, selector);
      }
      case InstructionType.Input: {
        const inputSpec = payload.replace(/^input\s+/i, '');
        return this.executeInput(page, inputSpec);
      }
      case InstructionType.Wait: {
        const durationStr = payload.replace(/^wait\s*/i, '').trim();
        return this.executeWait(durationStr);
      }
      case InstructionType.Screenshot:
        return this.executeScreenshot(page);
      default:
        return { success: false, error: `未知指令类型: ${String(type)}` };
    }
  }

  /**
   * 导航：domcontentloaded 即返回 + 沉降等待。
   * 不用 networkidle：创作者平台（抖音/小红书）存在长轮询与持续上报，
   * networkidle 常永不达成 → 等满 60s 超时 × 3 次重试，用户端表现为数分钟假死。
   */
  private async executeNavigate(page: Page, url: string): Promise<StepResult> {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      // 沉降等待：首屏关键渲染/接口尽量完成，截图与点击更稳定
      await page.waitForTimeout(1500);
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: `导航失败: ${errMessage(err)}` };
    }
  }

  /** 点击：等可见 → 滚动居中 → 点击 */
  private async executeClick(page: Page, selector: string): Promise<StepResult> {
    try {
      await page.waitForSelector(selector, { state: 'visible', timeout: 5000 });
      await page
        .evaluate((sel: string) => {
          document.querySelector(sel)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, selector)
        .catch(() => undefined);
      await page.click(selector, { timeout: 5000 });
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: `点击失败: ${errMessage(err)}` };
    }
  }

  /** 输入："selector:text" */
  private async executeInput(page: Page, inputSpec: string): Promise<StepResult> {
    const colonIndex = inputSpec.indexOf(':');
    if (colonIndex === -1) {
      return { success: false, error: '输入指令格式错误，应为 "input selector:text"' };
    }
    const selector = inputSpec.substring(0, colonIndex).trim();
    const text = inputSpec.substring(colonIndex + 1).trim();
    try {
      await page.waitForSelector(selector, { state: 'visible', timeout: 5000 });
      await page.fill(selector, text);
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: `输入失败: ${errMessage(err)}` };
    }
  }

  /** 等待：毫秒数，上限 60s */
  private async executeWait(durationStr: string): Promise<StepResult> {
    const duration = parseInt(durationStr, 10);
    if (isNaN(duration) || duration < 0) {
      return { success: false, error: `无效等待时长: ${durationStr}` };
    }
    const safeDuration = Math.min(duration, 60000);
    await new Promise((r) => setTimeout(r, safeDuration));
    return { success: true };
  }

  /** 截图：当前页 fullPage，返回 base64 */
  private async executeScreenshot(page: Page): Promise<StepResult> {
    try {
      const buffer = await page.screenshot({ fullPage: true });
      return { success: true, screenshot: buffer.toString('base64') };
    } catch (err: unknown) {
      return { success: false, error: `截图失败: ${errMessage(err)}` };
    }
  }

  /** 错误是否值得重试（瞬时性错误） */
  private isRetryableError(error: string): boolean {
    const retryable = ['timeout', 'network', 'connection', 'disconnected', 'target closed'];
    const lower = error.toLowerCase();
    return retryable.some((kw) => lower.includes(kw));
  }

  getExecutionHistory() {
    return this.executionHistory;
  }

  clearHistory(): void {
    this.executionHistory = [];
  }
}
