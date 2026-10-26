/**
 * 小红书适配器
 * 处理小红书创作者中心的自动化流程，内置智能错误恢复和多种登录方案支持
 */

import { Injectable } from '@nestjs/common';
import { Page } from 'playwright';
import { InstructionExecutor } from './instruction-executor';
import { AuditService } from '../modules/n/audit.service';
import { TenantContext } from '../tenant/tenant-context';
import { errMessage } from './err-msg';
import { PlatformAdapterBase, type PublishOutcome, type PublishStep } from './adapter-base';

/** 小红书各字段候选选择器（按优先级尝试） */
const TITLE_SELECTORS = [
  'input[placeholder*="标题"]',
  '.note-title-input',
  '#title',
  'input[name="title"]',
];
const CONTENT_SELECTORS = ['.rich-text-editor', '.note-content', 'textarea', '.editor-container'];
const TAG_INPUT_SELECTOR = 'input[placeholder*="添加标签"], .tag-input';


@Injectable()
export class XiaohongshuAdapter extends PlatformAdapterBase {
  private executor: InstructionExecutor;
  private readonly BASE_URL = 'https://creator.xiaohongshu.com/';
  private readonly LOGIN_URL = 'https://creator.xiaohongshu.com/login';
  private readonly CREATE_URL = 'https://creator.xiaohongshu.com/create';
  protected readonly RETRY_COUNT = 3;
  protected readonly adapterName = 'xiaohongshu';
  private readonly RETRY_DELAY = 1000;

  constructor(auditService: AuditService, executor?: InstructionExecutor) {
    super(auditService);
    this.executor = executor || new InstructionExecutor(3, 1000);
  }

  async init(): Promise<void> {
    const tenantId = TenantContext.requireTenantId();
    await this.executor.init();
    await this.audit.record({
      action: 'xiaohongshu_adapter_init',
      module: 'browser-workbench',
      resource: `tenant:${tenantId}`,
    });
  }

  /**
   * 登录小红书创作者后台
   * 支持二维码扫码登录和短信验证码登录两种方案
   */
  async login(page: Page): Promise<{ success: boolean; qrCode?: string; error?: string }> {
    let retryCount = 0;

    while (retryCount <= this.RETRY_COUNT) {
      try {
        await page.goto(this.LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(1500);

        // 检测是否已登录
        const isLoggedIn = await page.evaluate(() => {
          const welcome = document.querySelector('.user-info');
          const loginBtn = document.querySelector('.login-button');
          return !loginBtn || (welcome && (welcome as HTMLElement).offsetWidth > 0);
        });

        if (isLoggedIn) {
          await this.audit.record({
            action: 'xiaohongshu_login_already',
            module: 'browser-workbench',
          });
          return { success: true };
        }

        // 尝试查找二维码元素
        const qrElement = await page.$('.qr-code, .scan-code, .login-qr');
        if (qrElement) {
          const qrBuffer = await qrElement.screenshot();
          const qrBase64 = qrBuffer.toString('base64');
          await this.audit.record({
            action: 'xiaohongshu_login_qr_generated',
            module: 'browser-workbench',
          });
          return {
            success: true,
            qrCode: qrBase64,
          };
        }

        // 检查是否有验证码输入框
        const captchaInput = await page.$('input[type="text"][placeholder*="验证"]');
        if (captchaInput) {
          await this.audit.record({
            action: 'xiaohongshu_login_captcha_detected',
            module: 'browser-workbench',
          });
          return {
            success: false,
            error: '需要验证码登录，请人工输入或切换登录方式',
          };
        }

        // 短暂等待并重试
        await page.waitForTimeout(2000);
        retryCount++;

        if (retryCount > this.RETRY_COUNT) {
          await this.audit.record({
            action: 'xiaohongshu_login_no_option_after_retries',
            module: 'browser-workbench',
          });
          return { success: true };
        }
      } catch (err: unknown) {
        await this.audit.record({
          action: 'xiaohongshu_login_error',
          module: 'browser-workbench',
          resource: `error:${errMessage(err)}`,
        });
        retryCount++;

        if (retryCount > this.RETRY_COUNT) {
          return {
            success: false,
            error: `登录失败（已重试${this.RETRY_COUNT}次）: ${errMessage(err)}`,
          };
        }

        await new Promise((resolve) => setTimeout(resolve, this.RETRY_DELAY * retryCount));
      }
    }

    return {
      success: false,
      error: '登录流程异常退出',
    };
  }

  /**
   * 导航到创作中心
   * 包含页面加载等待和关键元素检测
   */
  async navigateToCreate(page: Page): Promise<{ success: boolean; error?: string }> {
    let retryCount = 0;

    while (retryCount <= this.RETRY_COUNT) {
      try {
        await page.goto(this.CREATE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(1500);

        // 等待创作页面加载关键元素
        const createSection = await page.$('.create-section, .new-post-btn, .start-creating');

        if (createSection) {
          await this.audit.record({
            action: 'xiaohongshu_navigate_to_create',
            module: 'browser-workbench',
          });
          return { success: true };
        }

        // 页面可能还在加载
        await page.waitForTimeout(3000);
        retryCount++;
      } catch (err: unknown) {
        await this.audit.record({
          action: 'xiaohongshu_navigate_error',
          module: 'browser-workbench',
          resource: `error:${errMessage(err)}`,
        });
        retryCount++;
      }
    }

    return {
      success: false,
      error: `无法导航到创作中心（已重试${this.RETRY_COUNT}次）`,
    };
  }

  /**
   * 上传图片素材
   */
  async uploadMaterial(
    page: Page,
    filePath: string,
  ): Promise<{ success: boolean; error?: string }> {
    let retryCount = 0;

    while (retryCount <= this.RETRY_COUNT) {
      try {
        // 等待文件上传控件出现
        const fileInput = await page.$('input[type="file"]');
        if (fileInput) {
          await fileInput.setInputFiles(filePath);
          await this.audit.record({
            action: 'xiaohongshu_upload_material',
            module: 'browser-workbench',
          });
          return { success: true };
        }

        await page.waitForTimeout(1000);
        retryCount++;
      } catch (err: unknown) {
        await this.audit.record({
          action: 'xiaohongshu_upload_error',
          module: 'browser-workbench',
          resource: `error:${errMessage(err)}`,
        });
        retryCount++;
      }
    }

    return {
      success: false,
      error: `上传素材失败（已重试${this.RETRY_COUNT}次）`,
    };
  }

  /**
   * 填写笔记标题和内容
   * 支持多种编辑器类型的智能定位
   */
  async fillNoteMetadata(
    page: Page,
    title: string,
    content: string,
    tags: string[],
  ): Promise<{ success: boolean; error?: string }> {
    let retryCount = 0;

    while (retryCount <= this.RETRY_COUNT) {
      try {
        // 标题：候选选择器依次尝试，未命中即失败
        const filled = await this.tryFillFirst(page, TITLE_SELECTORS, title);
        if (!filled) {
          throw new Error('无法定位标题输入框');
        }
        // 正文：支持富文本编辑器多种形态，未命中不阻断
        if (content) {
          await this.tryFillFirst(page, CONTENT_SELECTORS, content);
        }
        // 标签：同一输入框重复填充 + 回车提交
        if (tags.length > 0) {
          await this.repeatFill(page, TAG_INPUT_SELECTOR, tags);
        }

        await this.audit.record({
          action: 'xiaohongshu_fill_metadata',
          module: 'browser-workbench',
        });
        return { success: true };
      } catch (err: unknown) {
        await this.audit.record({
          action: 'xiaohongshu_fill_metadata_error',
          module: 'browser-workbench',
          resource: `error:${errMessage(err)}`,
        });
        retryCount++;
      }
    }

    return {
      success: false,
      error: `填写笔记信息失败（已重试${this.RETRY_COUNT}次）`,
    };
  }

  /**
   * 发布笔记
   */
  async publishNote(page: Page): Promise<{ success: boolean; error?: string }> {
    let retryCount = 0;

    while (retryCount <= this.RETRY_COUNT) {
      try {
        // 等待并点击发布按钮
        const publishBtn = await page.$('.publish-btn, .btn-publish, button[type="submit"]');
        if (publishBtn) {
          // 等待按钮可点击
          await page.waitForSelector('.publish-btn, .btn-publish', {
            state: 'visible',
            timeout: 5000,
          });
          await publishBtn.click();

          // 等待发布结果
          await page.waitForTimeout(3000);

          await this.audit.record({
            action: 'xiaohongshu_publish_note',
            module: 'browser-workbench',
          });
          return { success: true };
        }

        await page.waitForTimeout(1000);
        retryCount++;
      } catch (err: unknown) {
        await this.audit.record({
          action: 'xiaohongshu_publish_error',
          module: 'browser-workbench',
          resource: `error:${errMessage(err)}`,
        });
        retryCount++;
      }
    }

    return {
      success: false,
      error: `发布笔记失败（已重试${this.RETRY_COUNT}次）`,
    };
  }

  /**
   * 完整发布流程（一键完成）
   */
  async fullPublish(
    page: Page,
    filePath: string,
    title: string,
    tags: string[],
  ): Promise<PublishOutcome> {
    const steps: PublishStep[] = [
      { name: 'navigate', failLabel: '导航到创作中心', run: (p) => this.navigateToCreate(p) },
      { name: 'upload', failLabel: '上传素材', run: (p) => this.uploadMaterial(p, filePath) },
      {
        name: 'fillNoteMetadata',
        failLabel: '填写笔记信息',
        run: (p) => this.fillNoteMetadata(p, title, '', tags),
      },
      { name: 'publishNote', failLabel: '发布笔记', run: (p) => this.publishNote(p) },
    ];
    return this.runPublishPipeline(page, steps);
  }
}
