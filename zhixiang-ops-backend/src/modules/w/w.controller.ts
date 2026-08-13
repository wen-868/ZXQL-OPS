import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { RevenueService } from './w.service';
import { CreateRevenueDto } from './dto/create-revenue.dto';
import { ReconcileDto } from './dto/reconciliation.dto';
import { SettleDto } from './dto/settle.dto';
import { ok } from '../../shared/response';

/**
 * W 收益与对账控制器（规划 §4-W，envelope 见 §12）。
 * 统一前缀 api/ops。
 */
@Controller('ops')
export class RevenueController {
  constructor(private readonly revenueService: RevenueService) {}

  @Post('revenue')
  async recordRevenue(@Body() dto: CreateRevenueDto) {
    return ok(await this.revenueService.recordRevenue(dto));
  }

  @Get('revenue')
  async listRevenue(@Query('source') source?: string) {
    return ok(await this.revenueService.listRevenue(source));
  }

  @Post('reconciliation')
  async reconcile(@Body() dto: ReconcileDto) {
    return ok(await this.revenueService.reconcile(dto));
  }

  @Get('reconciliation/:id')
  async getReconciliation(@Param('id') id: string) {
    return ok(await this.revenueService.getReconciliation(Number(id)));
  }

  @Post('settlement')
  async settle(@Body() dto: SettleDto) {
    return ok(await this.revenueService.settle(dto));
  }

  @Post('settlement/:id/invoice')
  async invoice(@Param('id') id: string) {
    return ok(await this.revenueService.invoice(Number(id)));
  }

  @Get('profit')
  async profit() {
    return ok(await this.revenueService.profit());
  }
}
