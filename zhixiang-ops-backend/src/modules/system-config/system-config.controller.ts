import { Controller, Get, Param, Put, Body } from '@nestjs/common';
import { SystemConfigService } from './system-config.service';
import { UpdateConfigDto } from './dto/update-config.dto';
import { ok } from '../../shared/response';

/**
 * 系统配置中心（设置 → 系统配置）。
 * 客户自决外部服务凭据（抖音 OAuth 等），敏感值加密存储、列表掩码展示。
 * 路由前缀 ops/system-configs（全局前缀 api → /api/ops/system-configs）。
 */
@Controller('ops/system-configs')
export class SystemConfigController {
  constructor(private readonly svc: SystemConfigService) {}

  /** 配置列表（敏感值掩码） */
  @Get()
  async list() {
    return ok({ list: await this.svc.list() });
  }

  /** 读取单个配置明文（敏感值经解密返回；仅管理端调用场景） */
  @Get(':key')
  async get(@Param('key') key: string) {
    return ok({ key, value: await this.svc.get(key) });
  }

  /** 更新配置（传空字符串清除） */
  @Put(':key')
  async update(@Param('key') key: string, @Body() dto: UpdateConfigDto) {
    return ok(await this.svc.set(key, dto.value));
  }
}
