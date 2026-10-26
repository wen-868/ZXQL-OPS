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
import { Roles } from '../../auth/roles.decorator';
import { TenantContext } from '../../tenant/tenant-context';
import { LlmProviderService } from './llm.service';
import { CreateLlmProviderDto, LlmProviderQueryDto, UpdateLlmProviderDto } from './llm.dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

/** 大模型配置（设置 → 大模型配置）。路由前缀 api/ops/llm */
@ApiTags('llm')
@Controller('ops/llm')
export class LlmController {
  constructor(private readonly svc: LlmProviderService) {}

  @Get()
  @ApiOperation({ summary: 'GET list' })
  list(@Query() q: LlmProviderQueryDto) {
    return this.svc.list(q, TenantContext.requireTenantId());
  }

  @Get(':id')
  @ApiOperation({ summary: 'GET detail' })
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.svc.detail(id, TenantContext.requireTenantId());
  }

  /** 大模型凭据管理：仅管理员 */
  @Roles('admin')
  @Post()
  @ApiOperation({ summary: '大模型凭据管理：仅管理员 */' })
  create(@Body() dto: CreateLlmProviderDto) {
    return this.svc.create(dto, TenantContext.requireTenantId());
  }

  @Roles('admin')
  @Put(':id')
  @ApiOperation({ summary: 'PUT update' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLlmProviderDto) {
    return this.svc.update(id, dto, TenantContext.requireTenantId());
  }

  @Roles('admin')
  @Delete(':id')
  @ApiOperation({ summary: 'DELETE remove' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.svc.remove(id, TenantContext.requireTenantId());
  }

  @Roles('admin')
  @Post(':id/test')
  @ApiOperation({ summary: 'POST test' })
  test(@Param('id', ParseIntPipe) id: number) {
    return this.svc.testConnection(id, TenantContext.requireTenantId());
  }
}
