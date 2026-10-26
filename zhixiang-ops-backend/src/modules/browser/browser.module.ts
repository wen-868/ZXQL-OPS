import { Module } from '@nestjs/common';
import { BrowserController } from './browser.controller';
import { BrowserService } from './browser.service';
import { BrowserGateway } from '../../playwright/BrowserGateway';
import { BrowserWsGateway } from './browser-ws.gateway';
import { InstructionExecutor } from '../../playwright/instruction-executor';
import { DouyinAdapter } from '../../playwright/douyin-adapter';
import { XiaohongshuAdapter } from '../../playwright/xiaohongshu-adapter';
import { VideoNumberAdapter } from '../../playwright/video-number-adapter';
import { NModule } from '../n/n.module';

/**
 * 浏览器模块：
 * - BrowserService/Controller：既有页面观察 HTTP 接口
 * - BrowserGateway：Playwright 实例池 + 指令执行（熔断/审计）
 * - BrowserWsGateway：工作台实时画面与指令通道（原生 ws /browser）
 * - InstructionExecutor：共享指令执行器（供适配器注入）
 * - 三平台适配器（抖音/小红书/视频号）：登录与发布流水线
 */
@Module({
  imports: [NModule],
  controllers: [BrowserController],
  providers: [
    BrowserService,
    BrowserGateway,
    BrowserWsGateway,
    InstructionExecutor,
    DouyinAdapter,
    XiaohongshuAdapter,
    VideoNumberAdapter,
  ],
  exports: [
    BrowserService,
    BrowserGateway,
    DouyinAdapter,
    XiaohongshuAdapter,
    VideoNumberAdapter,
  ],
})
export class BrowserModule {}
