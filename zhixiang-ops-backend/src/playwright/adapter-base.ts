import type { Page } from 'playwright';
import { AuditService } from '../modules/n/audit.service';
import { errMessage } from './err-msg';

/** 平台适配器发布流水线的单步结果 */
export interface StepOutcome {
  success: boolean;
  error?: string;
}

/** fullPublish 的统一返回结构 */
export interface PublishOutcome {
  success: boolean;
  error?: string;
  screenshot?: string;
  result?: { passed: boolean; message: string; retryCount: number };
}

/** 发布流水线步骤定义 */
export interface PublishStep {
  /** 步骤名（缺省错误前缀） */
  name: string;
  /** 失败信息前缀（如「导航」「上传素材」），缺省用 name */
  failLabel?: string;
  run: (page: Page) => Promise<StepOutcome>;
}

/** 结果页成功/失败关键词 */
const SUCCESS_KEYWORDS = ['成功', '完成', '发布成功'];
const ERROR_KEYWORDS = ['失败', '错误', '报错'];

/** 结果页文本 → 成功判定（含错误词/流水线中断均判失败） */
function evaluatePublishOutcome(
  text: string,
  lastError?: string,
): { hasError: boolean; passed: boolean } {
  const hasError = ERROR_KEYWORDS.some((k) => text.includes(k));
  const hasSuccess = SUCCESS_KEYWORDS.some((k) => text.includes(k));
  return { hasError, passed: hasSuccess && !hasError && !lastError };
}

/**
 * 平台适配器基类：提取三端（抖音/视频号/小红书）共用的
 * 「多选择器定位填充」「逐对填标签」「fullPublish 流水线编排」逻辑。
 * 各平台只声明步骤与选择器差异，主流程圈复杂度由 13~16 降至 ~5。
 */
export abstract class PlatformAdapterBase {
  constructor(protected readonly audit: AuditService) {}

  /** 子类声明：重试次数与审计动作前缀（douyin / video_number / xiaohongshu） */
  protected abstract readonly RETRY_COUNT: number;
  protected abstract readonly adapterName: string;

  /** 按顺序尝试多个选择器，命中即填充；全部未命中返回 false */
  protected async tryFillFirst(page: Page, selectors: string[], value: string): Promise<boolean> {
    for (const selector of selectors) {
      try {
        const input = await page.$(selector);
        if (!input) continue;
        await page.fill(selector, value);
        return true;
      } catch {
        /* 选择器不存在/不可用，试下一个 */
      }
    }
    return false;
  }

  /** 逐对填充「标签输入框 + 标签值」（数量取较短一方，单个失败不阻断） */
  protected async fillPairs(page: Page, inputs: string[], values: string[]): Promise<void> {
    const pairs = Math.min(inputs.length, values.length);
    for (let i = 0; i < pairs; i++) {
      try {
        await page.fill(inputs[i] || '', values[i]);
        await page.keyboard.press('Enter');
      } catch {
        /* ignore */
      }
    }
  }

  /** 多元素句柄版逐对填充（选择器命中多个输入框时使用；单个失败不阻断） */
  protected async fillHandles(page: Page, selector: string, values: string[]): Promise<void> {
    const handles = await page.$$(selector);
    const pairs = Math.min(handles.length, values.length);
    for (let i = 0; i < pairs; i++) {
      try {
        await handles[i].fill(values[i]);
        await page.keyboard.press('Enter');
      } catch {
        /* ignore */
      }
    }
  }

  /** 单输入框重复填充（同一元素逐个填值 + 回车提交；元素不存在则跳过） */
  protected async repeatFill(page: Page, selector: string, values: string[]): Promise<void> {
    const input = await page.$(selector);
    if (!input) return;
    for (const value of values) {
      try {
        await input.fill(value);
        await page.keyboard.press('Enter');
      } catch {
        /* ignore */
      }
    }
  }

  /** 读取页面正文文本（失败回落空串） */
  protected async pageText(page: Page): Promise<string> {
    try {
      return await page.evaluate(() => document.body.innerText || '');
    } catch {
      return '';
    }
  }

  /**
   * 通用 fullPublish 编排：按步骤顺序执行，失败即停；
   * 结果页文本判定成功/失败，统一截图与审计。
   */
  protected async runPublishPipeline(page: Page, steps: PublishStep[]): Promise<PublishOutcome> {
    const startTime = Date.now();
    const lastError = await this.runSteps(page, steps);

    const screenshot = await page.screenshot({ fullPage: true });
    const { hasError, passed } = evaluatePublishOutcome(await this.pageText(page), lastError);

    const duration = Date.now() - startTime;
    await this.audit.record({
      action: `${this.adapterName}_full_publish`,
      module: 'browser-workbench',
      resource: `duration:${duration},passed:${passed}`,
    });

    return {
      success: passed,
      error: hasError ? lastError : undefined,
      screenshot: screenshot.toString('base64'),
      result: {
        passed,
        message: passed ? '发布成功' : (lastError ?? '发布过程中出现异常'),
        retryCount: this.RETRY_COUNT,
      },
    };
  }

  /** 顺序执行流水线步骤；返回首个失败步骤的错误信息（全部成功返回 undefined） */
  private async runSteps(page: Page, steps: PublishStep[]): Promise<string | undefined> {
    for (const step of steps) {
      const outcome = await this.guardStep(page, step);
      if (!outcome.success) {
        return `${step.failLabel ?? step.name}失败: ${outcome.error ?? '未知原因'}`;
      }
    }
    return undefined;
  }

  /** 单步执行 + 异常兜底（步骤内部异常不炸掉整条流水线） */
  private async guardStep(page: Page, step: PublishStep): Promise<StepOutcome> {
    try {
      return await step.run(page);
    } catch (err: unknown) {
      return { success: false, error: errMessage(err) };
    }
  }
}
