import { Controller, Get, Param, Put, Body } from '@nestjs/common';
import { Roles } from '../../auth/roles.decorator';
import { SystemConfigService } from './system-config.service';
import { UpdateConfigDto } from './dto/update-config.dto';
import { ok } from '../../shared/response';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

/**
 * 系统配置中心（设置 → 系统配置）。
 * 客户自决外部服务凭据（抖音 OAuth 等），敏感值加密存储、列表掩码展示。
 * 全局共享配置影响所有租户，仅管理员可读写。
 * 路由前缀 ops/system-configs（全局前缀 api → /api/ops/system-configs）。
 */
@Roles('admin')
@ApiTags('system-configs')
@Controller('ops/system-configs')
export class SystemConfigController {
  constructor(private readonly svc: SystemConfigService) {}

  /** 配置列表（敏感值掩码） */
  @Get()
  @ApiOperation({ summary: '配置列表（敏感值掩码） */' })
  async list() {
    return ok({ list: await this.svc.list() });
  }

  /**
   * 读取单个配置。
   * 安全收敛：敏感键一律只返回掩码，不在 HTTP 响应里回传明文
   * （明文仅供服务内部经 SystemConfigService.get() 消费，如 OAuth 换 Token）。
   */
  @Get(':key')
  @ApiOperation({ summary: '读取单个配置（敏感值掩码返回） */' })
  async get(@Param('key') key: string) {
    return ok({ key, value: await this.svc.getMasked(key) });
  }

  /** 更新配置（传空字符串清除） */
  @Put(':key')
  @ApiOperation({ summary: '更新配置（传空字符串清除） */' })
  async update(@Param('key') key: string, @Body() dto: UpdateConfigDto) {
    return ok(await this.svc.set(key, dto.value));
  }
}
