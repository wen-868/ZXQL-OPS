import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { Public } from '../../auth/public.decorator';
import { DashboardService } from './m.service';
import { CreateDashboardDto, UpdateDashboardDto } from './dto';

/**
 * 决策仪表盘与 BI 控制器（规划 §4-M / 开发顺序 M 仪表盘与 BI）。
 * 路由前缀 ops（全局前缀 api → /api/ops/*）。统一 BI 聚合层：核心指标卡/趋势、全链路漏斗、
 * 账号对比、选题效能榜、人性钩子分析、仪表盘配置 CRUD。租户隔离由服务层强约束。
 * 注：原 J(recycle) 控制器的 /dashboard/overview、/dashboard/driver-efficiency 已迁至此（避免路由冲突）。
 * 只读聚合接口标记 @Public（决策看板免登门户 + 租户头隔离），配置 CRUD 保持鉴权。
 */
@Controller('ops')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /** GET /api/ops/dashboard/overview — 核心指标卡 + 趋势（五维四率，复用 J） */
  @Public()
  @Get('dashboard/overview')
  getOverview() {
    return this.dashboardService.getOverview();
  }

  /** GET /api/ops/dashboard/funnel — 全链路漏斗（内容生产率→分发覆盖→触达→互动→转化→收益） */
  @Public()
  @Get('dashboard/funnel')
  getFunnel() {
    return this.dashboardService.getFunnel();
  }

  /** GET /api/ops/dashboard/account-compare — 账号对比 */
  @Public()
  @Get('dashboard/account-compare')
  getAccountCompare() {
    return this.dashboardService.getAccountCompare();
  }

  /** GET /api/ops/dashboard/topic-efficiency — 选题效能榜 */
  @Public()
  @Get('dashboard/topic-efficiency')
  getTopicEfficiency() {
    return this.dashboardService.getTopicEfficiency();
  }

  /** GET /api/ops/dashboard/human-hook — 人性钩子分析（7×6，复用 J 人性效能） */
  @Public()
  @Get('dashboard/human-hook')
  getHumanHook() {
    return this.dashboardService.getHumanHook();
  }

  /** GET /api/ops/dashboards — 仪表盘配置列表 */
  @Get('dashboards')
  listDashboards() {
    return this.dashboardService.listDashboards();
  }

  /** POST /api/ops/dashboards — 新建仪表盘配置 */
  @Post('dashboards')
  createDashboard(@Body() dto: CreateDashboardDto) {
    return this.dashboardService.createDashboard(dto);
  }

  /** GET /api/ops/dashboards/:id — 仪表盘配置详情 */
  @Get('dashboards/:id')
  getDashboard(@Param('id') id: string) {
    return this.dashboardService.getDashboard(Number(id));
  }

  /** PUT /api/ops/dashboards/:id — 更新仪表盘配置 */
  @Put('dashboards/:id')
  updateDashboard(@Param('id') id: string, @Body() dto: UpdateDashboardDto) {
    return this.dashboardService.updateDashboard(Number(id), dto);
  }

  /** DELETE /api/ops/dashboards/:id — 删除仪表盘配置（软删） */
  @Delete('dashboards/:id')
  deleteDashboard(@Param('id') id: string) {
    return this.dashboardService.deleteDashboard(Number(id));
  }
}
