import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ok } from '../../shared/response';
import { OverseasService } from './x.service';
import {
  CreateOverseasPlatformDto,
  CreateOverseasVideoDto,
  CreateTranslationTaskDto,
  UpdateOverseasVideoDto,
} from './dto';

/**
 * 内容出海控制器（规划 §4-X / 开发顺序 X 内容出海 / 阶段3 增强）。
 * 路由前缀 overseas；tenantId 由全局中间件注入 TenantContext。
 */
@Controller('ops/overseas')
export class OverseasController {
  constructor(private readonly svc: OverseasService) {}

  @Post('platforms')
  async createPlatform(@Body() dto: CreateOverseasPlatformDto) {
    return ok(await this.svc.createPlatform(dto));
  }

  @Get('platforms')
  async listPlatforms() {
    return ok(await this.svc.listPlatforms());
  }

  @Get('platforms/:id')
  async getPlatform(@Param('id', ParseIntPipe) id: number) {
    return ok(await this.svc.getPlatform(id));
  }

  @Post('videos')
  async createOverseasVideo(@Body() dto: CreateOverseasVideoDto) {
    return ok(await this.svc.createOverseasVideo(dto));
  }

  @Get('videos')
  async listOverseasVideos() {
    return ok(await this.svc.listOverseasVideos());
  }

  @Get('videos/:id')
  async getOverseasVideo(@Param('id', ParseIntPipe) id: number) {
    return ok(await this.svc.getOverseasVideo(id));
  }

  @Patch('videos/:id')
  async updateOverseasVideo(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOverseasVideoDto,
  ) {
    return ok(await this.svc.updateOverseasVideo(id, dto));
  }

  @Post('videos/:id/publish')
  async publishOverseasVideo(@Param('id', ParseIntPipe) id: number, @Body('url') url?: string) {
    return ok(await this.svc.publishOverseasVideo(id, url));
  }

  @Post('translation-tasks')
  async createTranslationTask(@Body() dto: CreateTranslationTaskDto) {
    return ok(await this.svc.createTranslationTask(dto));
  }

  @Get('translation-tasks')
  async listTranslationTasks() {
    return ok(await this.svc.listTranslationTasks());
  }

  @Get('summary')
  async summary() {
    return ok(await this.svc.summary());
  }
}
