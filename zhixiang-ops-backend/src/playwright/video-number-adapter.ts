/**
 * 视频号适配器
 * 处理微信视频号创作者中心的自动化流程，内置微信登录专用优化
 */

import { Injectable } from '@nestjs/common';
import { Page } from 'playwright';
import { InstructionExecutor } from './instruction-executor';
import { AuditService } from '../modules/n/audit.service';
import { TenantContext } from '../tenant/tenant-context';
import { errMessage } from './err-msg';
import { PlatformAdapterBase, type PublishOutcome, type PublishStep } from './adapter-base';

/** 视频号各字段候选选择器（按优先级尝试） */
const TITLE_SELECTORS = [
  'input[placeholder*="标题"]',
  '.video-title-input',
  'input[name="title"]',
  '#title',
];
const SUMMARY_SELECTORS = [
  'textarea[placeholder*="摘要"]',
  '.description-input',
  'textarea[name="summary"]',
  '#summary',
];
const TAG_INPUT_SELECTOR = '.tag-input, input[placeholder*="添加标签"]';


@Injectable()
export class VideoNumberAdapter extends PlatformAdapterBase {
  private executor: InstructionExecutor;
  private readonly BASE_URL = 'https://videoaccount.weixin.qq.com/';
  private readonly LOGIN_URL = 'https://videoaccount.weixin.qq.com/login';
  private readonly CREATE_URL = 'https://videoaccount.weixin.qq.com/create';
  protected readonly RETRY_COUNT = 3;
  protected readonly adapterName = 'video_number';
  private readonly RETRY_DELAY = 1000;

  constructor(auditService: AuditService, executor?: InstructionExecutor) {
    super(auditService);
    this.executor = executor || new InstructionExecutor(3, 1000);
  }

  async init(): Promise<void> {
    const tenantId = TenantContext.requireTenantId();
    await this.executor.init();
    await this.audit.record({
      action: 'video_number_adapter_init',
      module: 'browser-workbench',
      resource: `tenant:${tenantId}`,
    });
  }

  /**
   * 登录视频号创作者后台
   * 采用微信扫码登录方案，专为企业微信和个人微信优化
   */
  async login(page: Page): Promise<{ success: boolean; qrCode?: string; error?: string }> {
    let retryCount = 0;

    while (retryCount <= this.RETRY_COUNT) {
      try {
        await page.goto(this.LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(1500);

        // 检测是否已登录
        const isLoggedIn = await page.evaluate(() => {
          const userAvatar = document.querySelector('.user-avatar, .profile-img');
          const logoutBtn = document.querySelector('.logout-button');
          return !logoutBtn || (userAvatar && (userAvatar as HTMLElement).offsetWidth > 0);
        });

        if (isLoggedIn) {
          await this.audit.record({
            action: 'video_number_login_already',
            module: 'browser-workbench',
          });
          return { success: true };
        }

        // 尝试查找二维码元素 (微信特有样式)
        const qrElement = await page.$('.qr-code, .scan-code, .login-qr, .wechat-qr');
        if (qrElement) {
          const qrBuffer = await qrElement.screenshot();
          const qrBase64 = qrBuffer.toString('base64');
          await this.audit.record({
            action: 'video_number_login_qr_generated',
            module: 'browser-workbench',
          });
          return {
            success: true,
            qrCode: qrBase64,
          };
        }

        // 检查是否有其他登录方式入口
        const otherLogin = await page.$('.other-login, .sms-login, .password-login');
        if (otherLogin) {
          await this.audit.record({
            action: 'video_number_login_other_method_available',
            module: 'browser-workbench',
          });
          return { success: true };
        }

        // 短暂等待并重试
        await page.waitForTimeout(2000);
        retryCount++;

        if (retryCount > this.RETRY_COUNT) {
          await this.audit.record({
            action: 'video_number_login_no_qr_after_retries',
            module: 'browser-workbench',
          });
          return { success: true };
        }
      } catch (err: unknown) {
        await this.audit.record({
          action: 'video_number_login_error',
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
   * 导航到内容创作页面
   * 包含视频号特定的页面加载检测
   */
  async navigateToCreate(page: Page): Promise<{ success: boolean; error?: string }> {
    let retryCount = 0;

    while (retryCount <= this.RETRY_COUNT) {
      try {
        await page.goto(this.CREATE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(1500);

        // 等待创作页面加载关键元素
        const createSection = await page.$('.create-section, .new-video-btn, .start-creation');

        if (createSection) {
          await this.audit.record({
            action: 'video_number_navigate_to_create',
            module: 'browser-workbench',
          });
          return { success: true };
        }

        // 页面可能还在加载
        await page.waitForTimeout(3000);
        retryCount++;
      } catch (err: unknown) {
        await this.audit.record({
          action: 'video_number_navigate_error',
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
   * 上传视频素材
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
            action: 'video_number_upload_material',
            module: 'browser-workbench',
          });
          return { success: true };
        }

        await page.waitForTimeout(1000);
        retryCount++;
      } catch (err: unknown) {
        await this.audit.record({
          action: 'video_number_upload_error',
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
   * 填写视频标题、摘要和标签
   * 微信视频号特有的字段配置
   */
  async fillVideoMetadata(
    page: Page,
    title: string,
    summary: string,
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
        // 摘要/描述：可选，未命中不阻断
        if (summary) {
          await this.tryFillFirst(page, SUMMARY_SELECTORS, summary);
        }
        // 标签：多元素句柄逐对填充（回车提交）
        if (tags.length > 0) {
          await this.fillHandles(page, TAG_INPUT_SELECTOR, tags);
        }

        await this.audit.record({
          action: 'video_number_fill_metadata',
          module: 'browser-workbench',
        });
        return { success: true };
      } catch (err: unknown) {
        await this.audit.record({
          action: 'video_number_fill_metadata_error',
          module: 'browser-workbench',
          resource: `error:${errMessage(err)}`,
        });
        retryCount++;
      }
    }

    return {
      success: false,
      error: `填写视频信息失败（已重试${this.RETRY_COUNT}次）`,
    };
  }

  /**
   * 发布视频
   */
  async publishVideo(page: Page): Promise<{ success: boolean; error?: string }> {
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
            action: 'video_number_publish_video',
            module: 'browser-workbench',
          });
          return { success: true };
        }

        await page.waitForTimeout(1000);
        retryCount++;
      } catch (err: unknown) {
        await this.audit.record({
          action: 'video_number_publish_error',
          module: 'browser-workbench',
          resource: `error:${errMessage(err)}`,
        });
        retryCount++;
      }
    }

    return {
      success: false,
      error: `发布视频失败（已重试${this.RETRY_COUNT}次）`,
    };
  }

  /**
   * 完整发布流程（一键完成）
   */
  async fullPublish(
    page: Page,
    filePath: string,
    title: string,
    summary: string,
    tags: string[],
  ): Promise<PublishOutcome> {
    const steps: PublishStep[] = [
      { name: 'navigate', failLabel: '导航到创作中心', run: (p) => this.navigateToCreate(p) },
      { name: 'upload', failLabel: '上传素材', run: (p) => this.uploadMaterial(p, filePath) },
      {
        name: 'fillVideoMetadata',
        failLabel: '填写视频信息',
        run: (p) => this.fillVideoMetadata(p, title, summary, tags),
      },
      { name: 'publishVideo', failLabel: '发布视频', run: (p) => this.publishVideo(p) },
    ];
    return this.runPublishPipeline(page, steps);
  }
}
