import {
  Body,
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BrowserService } from './browser.service';
import { SnapshotDto } from './browser.dto';
import { BrowserGateway } from '../../playwright/BrowserGateway';
import { DouyinAdapter } from '../../playwright/douyin-adapter';
import { XiaohongshuAdapter } from '../../playwright/xiaohongshu-adapter';
import { VideoNumberAdapter } from '../../playwright/video-number-adapter';

/**
 * AI 页面观察与浏览器工作台控制器。
 * - GET  /api/ops/browser/state       会话状态
 * - POST /api/ops/browser/navigate    仅导航（预热）
 * - POST /api/ops/browser/snapshot    截图 + 关键 DOM 摘要
 * - GET  /api/ops/browser/adapters    平台适配器能力清单
 * - POST /api/ops/browser/adapters/:platform/login  发起平台登录（池页面保留状态）
 * 会话为后端独立无头 Chromium（demo 登录），与用户浏览器解耦。
 */
@ApiTags('browser')
@Controller('ops/browser')
export class BrowserController {
  constructor(
    private readonly browserService: BrowserService,
    private readonly browserGateway: BrowserGateway,
    private readonly douyinAdapter: DouyinAdapter,
    private readonly xiaohongshuAdapter: XiaohongshuAdapter,
    private readonly videoNumberAdapter: VideoNumberAdapter,
  ) {}

  /** GET /api/ops/browser/state — 页面观察会话状态 */
  @Get('state')
  @ApiOperation({ summary: '页面观察会话状态' })
  state() {
    return this.browserService.state();
  }

  /** POST /api/ops/browser/navigate — 仅导航到目标页（预热/保持会话） */
  @Post('navigate')
  @ApiOperation({ summary: '导航到目标页（预热）' })
  navigate(@Body() dto: SnapshotDto) {
    return this.browserService.navigate(dto);
  }

  /** POST /api/ops/browser/snapshot — 截图 + 关键 DOM 摘要 */
  @Post('snapshot')
  @ApiOperation({ summary: '截图 + 关键 DOM 摘要' })
  snapshot(@Body() dto: SnapshotDto) {
    return this.browserService.snapshot(dto);
  }

  /** GET /api/ops/browser/adapters — 平台适配器能力清单 */
  @Get('adapters')
  @ApiOperation({ summary: '平台适配器能力清单（登录/发布流水线）' })
  adapters() {
    return [
      { platform: 'douyin', name: 'DouyinAdapter', capabilities: ['login', 'fullPublish'] },
      { platform: 'xiaohongshu', name: 'XiaohongshuAdapter', capabilities: ['login', 'fullPublish'] },
      { platform: 'video-number', name: 'VideoNumberAdapter', capabilities: ['login', 'fullPublish'] },
    ];
  }

  /**
   * POST /api/ops/browser/adapters/:platform/login — 发起平台登录。
   * 从实例池取页面执行适配器 login（登录检测/二维码生成），
   * 页面归还池中保留状态，便于后续轮询登录结果。
   */
  @Post('adapters/:platform/login')
  @ApiOperation({ summary: '发起平台登录（douyin/xiaohongshu/video-number）' })
  async adapterLogin(@Param('platform') platform: string) {
    const adapter = this.resolveAdapter(platform);
    const acquired = await this.browserGateway.getBrowserPage();
    if (!acquired) {
      return { success: false, error: 'No available browser instance (pool exhausted or circuit open)' };
    }
    const { page, instanceId } = acquired;
    try {
      return await adapter.login(page);
    } finally {
      this.browserGateway.releaseBrowserPage(instanceId, page);
    }
  }

  /** 未知平台直接 400（避免误触池资源） */
  private resolveAdapter(platform: string) {
    switch (platform) {
      case 'douyin':
        return this.douyinAdapter;
      case 'xiaohongshu':
        return this.xiaohongshuAdapter;
      case 'video-number':
        return this.videoNumberAdapter;
      default:
        throw new BadRequestException(`未知平台: ${platform}（支持 douyin/xiaohongshu/video-number）`);
    }
  }
}
