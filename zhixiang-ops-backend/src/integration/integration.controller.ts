import { Body, Controller, Get, Headers, Put } from '@nestjs/common';
import { IntegrationService } from './integration.service';
import { UpdateSyncConfigDto } from './dto/update-sync-config.dto';
import { ok } from '../shared/response';

/**
 * 双模式接入与主数据同步配置（P3 客户自决）。
 * - GET /api/ops/integration/config：当前模式、同步开关、可同步条件
 * - PUT /api/ops/integration/config：更新同步开关（开启需满足条件门禁）
 */
@Controller('ops/integration')
export class IntegrationController {
  constructor(private readonly svc: IntegrationService) {}

  @Get('config')
  async getConfig(@Headers('x-tenant-id') tenantId?: string) {
    return ok(await this.svc.getSyncConfig(tenantId || 't_dev'));
  }

  @Put('config')
  async updateConfig(@Body() dto: UpdateSyncConfigDto, @Headers('x-tenant-id') tenantId?: string) {
    return ok(await this.svc.updateSyncConfig(tenantId || 't_dev', dto));
  }
}
