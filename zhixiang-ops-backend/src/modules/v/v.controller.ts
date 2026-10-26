import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ok } from '../../shared/response';
import { TalentCommerceService } from './v.service';
import { CreateBrandOrderDto, CreateTalentDto, SettleBrandOrderDto, UpdateTalentDto } from './dto';
import { BrandOrderStatus } from './brand-order.entity';
import { TalentStatus } from './talent.entity';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

/**
 * 达人/商单管理控制器（规划 §4-V / 开发顺序 V 达人/商单管理 / 阶段3 增强）。
 * 路由前缀 talent；tenantId 由全局中间件注入 TenantContext。
 */
@ApiTags('talent')
@Controller('ops/talent')
export class TalentCommerceController {
  constructor(private readonly svc: TalentCommerceService) {}

  @Post('talents')
  @ApiOperation({ summary: 'POST createTalent' })
  async createTalent(@Body() dto: CreateTalentDto) {
    return ok(await this.svc.createTalent(dto));
  }

  @Get('talents')
  @ApiOperation({ summary: 'GET listTalents' })
  async listTalents() {
    return ok(await this.svc.listTalents());
  }

  @Get('talents/:id')
  @ApiOperation({ summary: 'GET getTalent' })
  async getTalent(@Param('id', ParseIntPipe) id: number) {
    return ok(await this.svc.getTalent(id));
  }

  @Patch('talents/:id')
  @ApiOperation({ summary: 'PATCH updateTalent' })
  async updateTalent(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTalentDto) {
    return ok(await this.svc.updateTalent(id, dto));
  }

  @Post('talents/:id/status')
  @ApiOperation({ summary: 'POST setTalentStatus' })
  async setTalentStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: TalentStatus,
  ) {
    return ok(await this.svc.setTalentStatus(id, status));
  }

  @Delete('talents/:id')
  @ApiOperation({ summary: 'DELETE deleteTalent' })
  async deleteTalent(@Param('id', ParseIntPipe) id: number) {
    return ok(await this.svc.deleteTalent(id));
  }

  @Post('brand-orders')
  @ApiOperation({ summary: 'POST createBrandOrder' })
  async createBrandOrder(@Body() dto: CreateBrandOrderDto) {
    return ok(await this.svc.createBrandOrder(dto));
  }

  @Get('brand-orders')
  @ApiOperation({ summary: 'GET listBrandOrders' })
  async listBrandOrders() {
    return ok(await this.svc.listBrandOrders());
  }

  @Get('brand-orders/:id')
  @ApiOperation({ summary: 'GET getBrandOrder' })
  async getBrandOrder(@Param('id', ParseIntPipe) id: number) {
    return ok(await this.svc.getBrandOrder(id));
  }

  @Post('brand-orders/:id/status')
  @ApiOperation({ summary: 'POST setBrandOrderStatus' })
  async setBrandOrderStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: BrandOrderStatus,
  ) {
    return ok(await this.svc.setBrandOrderStatus(id, status));
  }

  @Post('brand-orders/:id/settle')
  @ApiOperation({ summary: 'POST settleBrandOrder' })
  async settleBrandOrder(@Param('id', ParseIntPipe) id: number, @Body() dto: SettleBrandOrderDto) {
    return ok(await this.svc.settleBrandOrder(id, dto));
  }

  @Delete('brand-orders/:id')
  @ApiOperation({ summary: 'DELETE deleteBrandOrder' })
  async deleteBrandOrder(@Param('id', ParseIntPipe) id: number) {
    return ok(await this.svc.deleteBrandOrder(id));
  }

  @Get('summary')
  @ApiOperation({ summary: 'GET summary' })
  async summary() {
    return ok(await this.svc.summary());
  }
}
