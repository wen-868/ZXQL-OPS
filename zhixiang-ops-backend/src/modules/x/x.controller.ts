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
import { ApiOperation, ApiTags } from '@nestjs/swagger';
@ApiTags('overseas')
@Controller('ops/overseas')
export class OverseasController {
  constructor(private readonly svc: OverseasService) {}

  @Post('platforms')
  @ApiOperation({ summary: 'POST createPlatform' })
  async createPlatform(@Body() dto: CreateOverseasPlatformDto) {
    return ok(await this.svc.createPlatform(dto));
  }

  @Get('platforms')
  @ApiOperation({ summary: 'GET listPlatforms' })
  async listPlatforms() {
    return ok(await this.svc.listPlatforms());
  }

  @Get('platforms/:id')
  @ApiOperation({ summary: 'GET getPlatform' })
  async getPlatform(@Param('id', ParseIntPipe) id: number) {
    return ok(await this.svc.getPlatform(id));
  }

  @Post('videos')
  @ApiOperation({ summary: 'POST createOverseasVideo' })
  async createOverseasVideo(@Body() dto: CreateOverseasVideoDto) {
    return ok(await this.svc.createOverseasVideo(dto));
  }

  @Get('videos')
  @ApiOperation({ summary: 'GET listOverseasVideos' })
  async listOverseasVideos() {
    return ok(await this.svc.listOverseasVideos());
  }

  @Get('videos/:id')
  @ApiOperation({ summary: 'GET getOverseasVideo' })
  async getOverseasVideo(@Param('id', ParseIntPipe) id: number) {
    return ok(await this.svc.getOverseasVideo(id));
  }

  @Patch('videos/:id')
  @ApiOperation({ summary: 'PATCH updateOverseasVideo' })
  async updateOverseasVideo(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOverseasVideoDto,
  ) {
    return ok(await this.svc.updateOverseasVideo(id, dto));
  }

  @Post('videos/:id/publish')
  @ApiOperation({ summary: 'POST publishOverseasVideo' })
  async publishOverseasVideo(@Param('id', ParseIntPipe) id: number, @Body('url') url?: string) {
    return ok(await this.svc.publishOverseasVideo(id, url));
  }

  @Post('translation-tasks')
  @ApiOperation({ summary: 'POST createTranslationTask' })
  async createTranslationTask(@Body() dto: CreateTranslationTaskDto) {
    return ok(await this.svc.createTranslationTask(dto));
  }

  @Get('translation-tasks')
  @ApiOperation({ summary: 'GET listTranslationTasks' })
  async listTranslationTasks() {
    return ok(await this.svc.listTranslationTasks());
  }

  @Get('summary')
  @ApiOperation({ summary: 'GET summary' })
  async summary() {
    return ok(await this.svc.summary());
  }
}
