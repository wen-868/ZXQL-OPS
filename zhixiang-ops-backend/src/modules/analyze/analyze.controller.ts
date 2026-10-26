import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { AnalyzeService } from './analyze.service';
import { CreateAnalysisTaskDto } from './dto/create-analysis-task.dto';
import { CreateInsightDto } from './dto/create-insight.dto';
import { InsightQueryDto } from './dto/insight-query.dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

/**
 * 人性分析与洞察引擎控制器（规划 §4-D）。
 * 路由前缀 ops/analyze（全局前缀 api → /api/ops/analyze）。
 * 租户隔离由服务层 TenantContext.requireTenantId() 强约束。
 * 注意：GET analysis/report 必须排在 GET analysis/:id 之前，避免被参数路由吞掉。
 */
@ApiTags('analyze')
@Controller('ops/analyze')
export class AnalyzeController {
  constructor(private readonly analyzeService: AnalyzeService) {}

  @Post('analysis')
  @ApiOperation({ summary: 'POST createAnalysisTask' })
  createAnalysisTask(@Body() dto: CreateAnalysisTaskDto) {
    return this.analyzeService.createAnalysisTask(dto);
  }

  @Get('analysis/report')
  @ApiOperation({ summary: 'GET getReport' })
  getReport() {
    return this.analyzeService.getReport();
  }

  @Get('analysis/:id')
  @ApiOperation({ summary: 'GET getAnalysisTask' })
  getAnalysisTask(@Param('id') id: string) {
    return this.analyzeService.getAnalysisTask(Number(id));
  }

  @Get('insights')
  @ApiOperation({ summary: 'GET listInsights' })
  listInsights(@Query() query: InsightQueryDto) {
    return this.analyzeService.listInsights(query);
  }

  @Post('insights')
  @ApiOperation({ summary: 'POST createInsight' })
  createInsight(@Body() dto: CreateInsightDto) {
    return this.analyzeService.createInsight(dto);
  }
}
