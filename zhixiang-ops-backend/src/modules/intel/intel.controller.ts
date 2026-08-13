import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { IntelService } from './intel.service';
import { CreateCompetitorDto } from './dto/create-competitor.dto';
import { UpdateCompetitorDto } from './dto/update-competitor.dto';
import { CreateCollectTaskDto } from './dto/create-collect-task.dto';
import { CollectedCommentQueryDto } from './dto/collected-comment-query.dto';
import { KeywordMineDto } from './dto/keyword-mine.dto';

/**
 * 情报采集控制器（规划 §4-C）。
 * 路由前缀 ops/intel（全局前缀 api → /api/ops/intel）。
 * 租户隔离由服务层 TenantContext.requireTenantId() 强约束。
 */
@Controller('ops/intel')
export class IntelController {
  constructor(private readonly intelService: IntelService) {}

  @Post('competitors')
  createCompetitor(@Body() dto: CreateCompetitorDto) {
    return this.intelService.createCompetitor(dto);
  }

  @Get('competitors')
  listCompetitors() {
    return this.intelService.listCompetitors();
  }

  @Get('competitors/:id')
  getCompetitor(@Param('id') id: string) {
    return this.intelService.findOneCompetitor(Number(id));
  }

  @Patch('competitors/:id')
  updateCompetitor(@Param('id') id: string, @Body() dto: UpdateCompetitorDto) {
    return this.intelService.updateCompetitor(Number(id), dto);
  }

  @Delete('competitors/:id')
  removeCompetitor(@Param('id') id: string) {
    return this.intelService.removeCompetitor(Number(id));
  }

  @Post('competitors/:id/monitor')
  toggleMonitor(@Param('id') id: string) {
    return this.intelService.toggleMonitor(Number(id));
  }

  @Post('collect')
  createCollectTask(@Body() dto: CreateCollectTaskDto) {
    return this.intelService.createCollectTask(dto);
  }

  @Get('collect/:id')
  getCollectTask(@Param('id') id: string) {
    return this.intelService.getCollectTask(Number(id));
  }

  @Get('collected-comments')
  listComments(@Query() query: CollectedCommentQueryDto) {
    return this.intelService.findCleanComments(query);
  }

  @Post('keywords/mine')
  mineKeywords(@Body() dto: KeywordMineDto) {
    return this.intelService.mineKeywords(dto);
  }

  @Get('hot')
  getHot(@Query('platform') platform: string, @Query('hotType') hotType: string) {
    return this.intelService.getHot(platform, hotType);
  }
}
