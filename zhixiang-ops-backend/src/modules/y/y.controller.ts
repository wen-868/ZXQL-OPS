import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ok } from '../../shared/response';
import { OrderService } from './y.service';
import {
  SyncOrdersDto,
  CreateWaybillDto,
  BatchWaybillDto,
  SyncInventoryDto,
  ListOrdersQueryDto,
} from './dto';

import { ApiOperation, ApiTags } from '@nestjs/swagger';
@ApiTags('ops')
@Controller('ops')
export class OrderController {
  constructor(private orderService: OrderService) {}

  /** 同步订单（双源 + 幂等） */
  @Post('orders/sync')
  @ApiOperation({ summary: '同步订单（双源 + 幂等） */' })
  async syncOrders(@Body() dto: SyncOrdersDto) {
    return ok(await this.orderService.syncOrders(dto));
  }

  /** 订单列表（按 status/platform 过滤） */
  @Get('orders')
  @ApiOperation({ summary: '订单列表（按 status/platform 过滤） */' })
  async listOrders(@Query() q: ListOrdersQueryDto) {
    return ok(await this.orderService.listOrders({ status: q.status, platform: q.platform }));
  }

  /** 订单详情 */
  @Get('orders/:id')
  @ApiOperation({ summary: '订单详情 */' })
  async getOrder(@Param('id') id: string) {
    return ok(await this.orderService.getOrder(Number(id)));
  }

  /** 退款（回写库存） */
  @Post('orders/:id/refund')
  @ApiOperation({ summary: '退款（回写库存） */' })
  async refund(@Param('id') id: string) {
    return ok(await this.orderService.refund(Number(id)));
  }

  /** 物流轨迹 */
  @Get('logistics/:orderId/track')
  @ApiOperation({ summary: '物流轨迹 */' })
  async getTrack(@Param('orderId') orderId: string) {
    return ok(await this.orderService.getLogisticsTrack(Number(orderId)));
  }

  /** 生成电子面单 */
  @Post('orders/:id/waybill')
  @ApiOperation({ summary: '生成电子面单 */' })
  async createWaybill(@Param('id') id: string, @Body() dto: CreateWaybillDto) {
    return ok(await this.orderService.createWaybill(Number(id), dto));
  }

  /** 批量生成面单 */
  @Post('orders/batch-waybill')
  @ApiOperation({ summary: '批量生成面单 */' })
  async batchWaybill(@Body() dto: BatchWaybillDto) {
    return ok(await this.orderService.batchWaybill(dto));
  }

  /** 仓储库存回传 */
  @Post('inventory/sync')
  @ApiOperation({ summary: '仓储库存回传 */' })
  async syncInventory(@Body() dto: SyncInventoryDto) {
    return ok(await this.orderService.syncInventory(dto));
  }

  /** 库存预警 */
  @Get('inventory/warn')
  @ApiOperation({ summary: '库存预警 */' })
  async inventoryWarn(@Query('threshold') threshold?: string) {
    return ok(await this.orderService.inventoryWarn(threshold ? Number(threshold) : 10));
  }
}
