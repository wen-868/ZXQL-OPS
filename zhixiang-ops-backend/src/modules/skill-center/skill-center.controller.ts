import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { TenantContext } from '../../tenant/tenant-context';
import { SkillCenterService } from './skill-center.service';
import { InstallSkillDto } from './dto/install-skill.dto';
import { SetProviderDto } from './dto/set-provider.dto';
import { CreateProviderDto } from './dto/create-provider.dto';

/**
 * 技能中心控制器（规划 §4-Z / ⑦ 管理平面）。
 * 路由前缀遵循约定为 ops/skills（全局前缀 api → 实际 /api/ops/skills）。
 */
@Controller('ops/skills')
export class SkillCenterController {
  constructor(private readonly svc: SkillCenterService) {}

  /** 技能市场：列出内置技能 + 本租户启用态 */
  @Get()
  async market() {
    const tenantId = TenantContext.requireTenantId();
    return { list: await this.svc.getMarket(tenantId) };
  }

  /** 本租户可绑定 Provider 列表（系统默认 + 自建 BYO） */
  @Get('providers')
  async providers() {
    const tenantId = TenantContext.requireTenantId();
    return { list: await this.svc.listProviders(tenantId) };
  }

  /** 创建 Provider（租户 BYO / 外部源） */
  @Post('providers')
  async createProvider(@Body() dto: CreateProviderDto) {
    const tenantId = TenantContext.requireTenantId();
    return this.svc.createProvider(tenantId, dto);
  }

  /** 删除 Provider（被技能绑定中禁止） */
  @Delete('providers/:id')
  async deleteProvider(@Param('id') id: string) {
    const tenantId = TenantContext.requireTenantId();
    return this.svc.deleteProvider(tenantId, Number(id));
  }

  /** 本租户已启用技能 */
  @Get('installed')
  async installed() {
    const tenantId = TenantContext.requireTenantId();
    return { list: await this.svc.getInstalled(tenantId) };
  }

  /** 启用技能(可绑定 Provider) */
  @Post(':id/install')
  async install(@Param('id') id: string, @Body() dto: InstallSkillDto) {
    const tenantId = TenantContext.requireTenantId();
    return this.svc.install(tenantId, Number(id), dto.providerId);
  }

  /** 禁用技能 */
  @Post(':id/uninstall')
  async uninstall(@Param('id') id: string) {
    const tenantId = TenantContext.requireTenantId();
    return this.svc.uninstall(tenantId, Number(id));
  }

  /** 改绑 Provider */
  @Put(':id/provider')
  async setProvider(@Param('id') id: string, @Body() dto: SetProviderDto) {
    const tenantId = TenantContext.requireTenantId();
    return this.svc.setProvider(tenantId, Number(id), dto.providerId);
  }
}
