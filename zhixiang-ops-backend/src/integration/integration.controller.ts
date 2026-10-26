import { Body, Controller, Get, Put } from '@nestjs/common';
import { TenantContext } from '../tenant/tenant-context';
import { Roles } from '../auth/roles.decorator';
import { IntegrationService } from './integration.service';
import { UpdateSyncConfigDto } from './dto/update-sync-config.dto';
import { ok } from '../shared/response';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

/**
 * 双模式接入与主数据同步配置（P3 客户自决）。
 * - GET /api/ops/integration/config：当前模式、同步开关、可同步条件
 * - PUT /api/ops/integration/config：更新同步开关（开启需满足条件门禁）
 * 租户一律取自登录态（JWT），不使用请求头；仅管理员可改配置。
 */
@ApiTags('integration')
@Controller('ops/integration')
export class IntegrationController {
  constructor(private readonly svc: IntegrationService) {}

  @Get('config')
  @ApiOperation({ summary: 'GET getConfig' })
  async getConfig() {
    return ok(await this.svc.getSyncConfig(TenantContext.requireTenantId()));
  }

  @Roles('admin')
  @Put('config')
  @ApiOperation({ summary: 'PUT updateConfig' })
  async updateConfig(@Body() dto: UpdateSyncConfigDto) {
    return ok(await this.svc.updateSyncConfig(TenantContext.requireTenantId(), dto));
  }
}
