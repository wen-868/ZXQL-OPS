import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('ops/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /** GET /api/ops/dashboard/stats �?工作台统计摘�?*/
  @Get('stats')
  stats() {
    return this.dashboardService.getStats();
  }
}