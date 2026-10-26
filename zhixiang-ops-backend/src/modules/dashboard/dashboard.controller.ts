import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('dashboard')
@Controller('ops/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /** GET /api/ops/dashboard/stats — 工作台统计摘要 */
  @Get('stats')
  @ApiOperation({ summary: '工作台统计摘要 */' })
  stats() {
    return this.dashboardService.getStats();
  }

  /** GET /api/ops/dashboard/skill-status — 技能调用状态 */
  @Get('skill-status')
  @ApiOperation({ summary: '技能调用状态 */' })
  async skillStatus() {
    return this.dashboardService.getSkillStatus();
  }

  /** GET /api/ops/dashboard/platform-status — 平台连接状态 */
  @Get('platform-status')
  @ApiOperation({ summary: '平台连接状态 */' })
  platformStatus() {
    return this.dashboardService.getPlatformStatus();
  }

  /** GET /api/ops/dashboard/humanity-distribution — 人性驱动分布 */
  @Get('humanity-distribution')
  @ApiOperation({ summary: '人性驱动分布 */' })
  humanityDistribution() {
    return this.dashboardService.getHumanityDistribution();
  }

  /** GET /api/ops/dashboard/recent-actions — 最近操作日志 */
  @Get('recent-actions')
  @ApiOperation({ summary: '最近操作日志 */' })
  recentActions() {
    return this.dashboardService.getRecentActions();
  }

  /** GET /api/ops/dashboard/todos — 待办聚合（发布/客诉/对账/投流） */
  @Get('todos')
  @ApiOperation({ summary: '待办聚合（发布/客诉/对账/投流） */' })
  todos() {
    return this.dashboardService.getTodos();
  }

  /** GET /api/ops/dashboard/trend?days=10 — 近 N 日订单趋势 */
  @Get('trend')
  @ApiOperation({ summary: '近 N 日订单趋势 */' })
  trend(@Query('days') days?: string) {
    const n = Number(days) > 0 ? Number(days) : 10;
    return this.dashboardService.getTrend(n);
  }

  /** GET /api/ops/dashboard/configs — 看板配置列表 */
  @Get('configs')
  @ApiOperation({ summary: '看板配置列表 */' })
  listConfigs() {
    return this.dashboardService.listConfigs();
  }

  /** POST /api/ops/dashboard/configs — 新建看板配置 */
  @Post('configs')
  @ApiOperation({ summary: '新建看板配置 */' })
  createConfig(@Body() body: { name: string; widgets: unknown[] }) {
    return this.dashboardService.createConfig(body.name, body.widgets ?? []);
  }

  /** PUT /api/ops/dashboard/configs/:id — 更新看板配置 */
  @Put('configs/:id')
  @ApiOperation({ summary: '更新看板配置 */' })
  async updateConfig(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name: string; widgets: unknown[] },
  ) {
    const updated = await this.dashboardService.updateConfig(id, body.name, body.widgets ?? []);
    return { updated: updated != null };
  }

  /** DELETE /api/ops/dashboard/configs/:id — 删除看板配置 */
  @Delete('configs/:id')
  @ApiOperation({ summary: '删除看板配置 */' })
  async deleteConfig(@Param('id', ParseIntPipe) id: number) {
    const deleted = await this.dashboardService.deleteConfig(id);
    return { deleted };
  }
}
