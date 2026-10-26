import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { RevenueService } from './w.service';
import { CreateRevenueDto } from './dto/create-revenue.dto';
import { ReconcileDto } from './dto/reconciliation.dto';
import { SettleDto } from './dto/settle.dto';
import { ok } from '../../shared/response';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

/**
 * W 收益与对账控制器（规划 §4-W，envelope 见 §12）。
 * 统一前缀 api/ops。
 */
@ApiTags('ops')
@Controller('ops')
export class RevenueController {
  constructor(private readonly revenueService: RevenueService) {}

  @Post('revenue')
  @ApiOperation({ summary: 'POST recordRevenue' })
  async recordRevenue(@Body() dto: CreateRevenueDto) {
    return ok(await this.revenueService.recordRevenue(dto));
  }

  @Get('revenue')
  @ApiOperation({ summary: 'GET listRevenue' })
  async listRevenue(@Query('source') source?: string) {
    return ok(await this.revenueService.listRevenue(source));
  }

  @Post('reconciliation')
  @ApiOperation({ summary: 'POST reconcile' })
  async reconcile(@Body() dto: ReconcileDto) {
    return ok(await this.revenueService.reconcile(dto));
  }

  @Get('reconciliation/:id')
  @ApiOperation({ summary: 'GET getReconciliation' })
  async getReconciliation(@Param('id') id: string) {
    return ok(await this.revenueService.getReconciliation(Number(id)));
  }

  @Post('settlement')
  @ApiOperation({ summary: 'POST settle' })
  async settle(@Body() dto: SettleDto) {
    return ok(await this.revenueService.settle(dto));
  }

  @Post('settlement/:id/invoice')
  @ApiOperation({ summary: 'POST invoice' })
  async invoice(@Param('id') id: string) {
    return ok(await this.revenueService.invoice(Number(id)));
  }

  @Get('profit')
  @ApiOperation({ summary: 'GET profit' })
  async profit() {
    return ok(await this.revenueService.profit());
  }
}
