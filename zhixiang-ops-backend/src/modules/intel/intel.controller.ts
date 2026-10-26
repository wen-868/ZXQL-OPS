import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { IntelService } from './intel.service';
import { CreateCompetitorDto } from './dto/create-competitor.dto';
import { UpdateCompetitorDto } from './dto/update-competitor.dto';
import { CreateCollectTaskDto } from './dto/create-collect-task.dto';
import { CollectedCommentQueryDto } from './dto/collected-comment-query.dto';
import { KeywordMineDto } from './dto/keyword-mine.dto';
import { CreateCollectSourceDto, UpdateCollectSourceDto } from './dto/collect-source.dto';
import {
  CollectControlDto,
  CommentBatchReviewDto,
  CommentReviewDto,
} from './dto/collect-control.dto';

/**
 * 情报采集控制器（规划 §4-C）。
 * 路由前缀 ops/intel（全局前缀 api → /api/ops/intel）。
 * 租户隔离由服务层 TenantContext.requireTenantId() 强约束。
 */
import { ApiOperation, ApiTags } from '@nestjs/swagger';
@ApiTags('intel')
@Controller('ops/intel')
export class IntelController {
  constructor(private readonly intelService: IntelService) {}

  // —— 采集源配置 ——
  @Post('sources')
  @ApiOperation({ summary: 'POST createSource' })
  createSource(@Body() dto: CreateCollectSourceDto) {
    return this.intelService.createSource(dto);
  }

  @Get('sources')
  @ApiOperation({ summary: 'GET listSources' })
  listSources() {
    return this.intelService.listSources();
  }

  @Patch('sources/:id')
  @ApiOperation({ summary: 'PATCH updateSource' })
  updateSource(@Param('id') id: string, @Body() dto: UpdateCollectSourceDto) {
    return this.intelService.updateSource(Number(id), dto);
  }

  @Delete('sources/:id')
  @ApiOperation({ summary: 'DELETE removeSource' })
  removeSource(@Param('id') id: string) {
    return this.intelService.removeSource(Number(id));
  }

  /** 由采集源发起一次采集（继承源配置） */
  @Post('sources/:id/collect')
  @ApiOperation({ summary: '由采集源发起一次采集（继承源配置） */' })
  collectFromSource(@Param('id') id: string) {
    return this.intelService.collectFromSource(Number(id));
  }

  // —— 竞品 ——
  @Post('competitors')
  @ApiOperation({ summary: 'POST createCompetitor' })
  createCompetitor(@Body() dto: CreateCompetitorDto) {
    return this.intelService.createCompetitor(dto);
  }

  @Get('competitors')
  @ApiOperation({ summary: 'GET listCompetitors' })
  listCompetitors() {
    return this.intelService.listCompetitors();
  }

  @Get('competitors/:id')
  @ApiOperation({ summary: 'GET getCompetitor' })
  getCompetitor(@Param('id') id: string) {
    return this.intelService.findOneCompetitor(Number(id));
  }

  @Patch('competitors/:id')
  @ApiOperation({ summary: 'PATCH updateCompetitor' })
  updateCompetitor(@Param('id') id: string, @Body() dto: UpdateCompetitorDto) {
    return this.intelService.updateCompetitor(Number(id), dto);
  }

  @Delete('competitors/:id')
  @ApiOperation({ summary: 'DELETE removeCompetitor' })
  removeCompetitor(@Param('id') id: string) {
    return this.intelService.removeCompetitor(Number(id));
  }

  @Post('competitors/:id/monitor')
  @ApiOperation({ summary: 'POST toggleMonitor' })
  toggleMonitor(@Param('id') id: string) {
    return this.intelService.toggleMonitor(Number(id));
  }

  // —— 采集任务 ——
  @Post('collect')
  @ApiOperation({ summary: 'POST createCollectTask' })
  createCollectTask(@Body() dto: CreateCollectTaskDto) {
    return this.intelService.createCollectTask(dto);
  }

  @Get('collect/:id')
  @ApiOperation({ summary: 'GET getCollectTask' })
  getCollectTask(@Param('id') id: string) {
    return this.intelService.getCollectTask(Number(id));
  }

  @Get('collect')
  @ApiOperation({ summary: 'GET listCollectTasks' })
  listCollectTasks(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.intelService.listCollectTasks(
      Number(page) || 1,
      Math.min(Number(pageSize) || 20, 100),
    );
  }

  /** 任务生命周期控制：pause / resume / cancel / retry */
  @Post('collect/:id/control')
  @ApiOperation({ summary: '任务生命周期控制：pause / resume / cancel / retry */' })
  controlCollectTask(@Param('id') id: string, @Body() dto: CollectControlDto) {
    return this.intelService.controlCollectTask(Number(id), dto.action);
  }

  // —— 采集评论 / 审核 ——
  @Get('collected-comments')
  @ApiOperation({ summary: 'GET listComments' })
  listComments(@Query() query: CollectedCommentQueryDto) {
    return this.intelService.findCleanComments(query);
  }

  @Post('comments/:id/review')
  @ApiOperation({ summary: 'POST reviewComment' })
  reviewComment(@Param('id') id: string, @Body() dto: CommentReviewDto) {
    return this.intelService.reviewComment(Number(id), dto.status);
  }

  @Post('comments/review-batch')
  @ApiOperation({ summary: 'POST reviewCommentsBatch' })
  reviewCommentsBatch(@Body() dto: CommentBatchReviewDto) {
    return this.intelService.reviewCommentsBatch(dto.ids, dto.status);
  }

  // —— 关键词 / 热点 ——
  @Post('keywords/mine')
  @ApiOperation({ summary: 'POST mineKeywords' })
  mineKeywords(@Body() dto: KeywordMineDto) {
    return this.intelService.mineKeywords(dto);
  }

  @Get('hot')
  @ApiOperation({ summary: 'GET getHot' })
  getHot(@Query('platform') platform: string, @Query('hotType') hotType: string) {
    return this.intelService.getHot(platform, hotType);
  }
}
