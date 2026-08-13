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
import { TenantContext } from '../../tenant/tenant-context';
import { LlmProviderService } from './llm.service';
import { CreateLlmProviderDto, LlmProviderQueryDto, UpdateLlmProviderDto } from './llm.dto';

/** 大模型配置（设置 → 大模型配置）。路由前缀 api/ops/llm */
@Controller('ops/llm')
export class LlmController {
  constructor(private readonly svc: LlmProviderService) {}

  @Get()
  list(@Query() q: LlmProviderQueryDto) {
    return this.svc.list(q, TenantContext.requireTenantId());
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.svc.detail(id, TenantContext.requireTenantId());
  }

  @Post()
  create(@Body() dto: CreateLlmProviderDto) {
    return this.svc.create(dto, TenantContext.requireTenantId());
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLlmProviderDto) {
    return this.svc.update(id, dto, TenantContext.requireTenantId());
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.svc.remove(id, TenantContext.requireTenantId());
  }

  @Post(':id/test')
  test(@Param('id', ParseIntPipe) id: number) {
    return this.svc.testConnection(id, TenantContext.requireTenantId());
  }
}
