import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { Roles } from '../../auth/roles.decorator';
import { TenantContext } from '../../tenant/tenant-context';
import { SkillCenterService } from './skill-center.service';
import { InstallSkillDto } from './dto/install-skill.dto';
import { SetProviderDto } from './dto/set-provider.dto';
import { CreateProviderDto } from './dto/create-provider.dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

/**
 * 技能中心控制器（规划 §4-Z / ⑦ 管理平面）。
 * 路由前缀遵循约定为 ops/skills（全局前缀 api → 实际 /api/ops/skills）。
 * 启用/禁用技能、绑定 Provider 影响租户 AI 调用链，仅管理员可操作。
 */
@ApiTags('skills')
@Controller('ops/skills')
export class SkillCenterController {
  constructor(private readonly svc: SkillCenterService) {}

  /** 技能市场：列出内置技能 + 本租户启用态 */
  @Get()
  @ApiOperation({ summary: '技能市场：列出内置技能 + 本租户启用态 */' })
  async market() {
    const tenantId = TenantContext.requireTenantId();
    return { list: await this.svc.getMarket(tenantId) };
  }

  /** 本租户可绑定 Provider 列表（系统默认 + 自建 BYO） */
  @Get('providers')
  @ApiOperation({ summary: '本租户可绑定 Provider 列表（系统默认 + 自建 BYO） */' })
  async providers() {
    const tenantId = TenantContext.requireTenantId();
    return { list: await this.svc.listProviders(tenantId) };
  }

  /** 创建 Provider（租户 BYO / 外部源）：仅管理员 */
  @Roles('admin')
  @Post('providers')
  @ApiOperation({ summary: '创建 Provider（租户 BYO / 外部源）：仅管理员 */' })
  async createProvider(@Body() dto: CreateProviderDto) {
    const tenantId = TenantContext.requireTenantId();
    return this.svc.createProvider(tenantId, dto);
  }

  /** 删除 Provider（被技能绑定中禁止）：仅管理员 */
  @Roles('admin')
  @Delete('providers/:id')
  @ApiOperation({ summary: '删除 Provider（被技能绑定中禁止）：仅管理员 */' })
  async deleteProvider(@Param('id') id: string) {
    const tenantId = TenantContext.requireTenantId();
    return this.svc.deleteProvider(tenantId, Number(id));
  }

  /** 本租户已启用技能 */
  @Get('installed')
  @ApiOperation({ summary: '本租户已启用技能 */' })
  async installed() {
    const tenantId = TenantContext.requireTenantId();
    return { list: await this.svc.getInstalled(tenantId) };
  }

  /** 启用技能(可绑定 Provider)：仅管理员 */
  @Roles('admin')
  @Post(':id/install')
  @ApiOperation({ summary: '启用技能(可绑定 Provider)：仅管理员 */' })
  async install(@Param('id') id: string, @Body() dto: InstallSkillDto) {
    const tenantId = TenantContext.requireTenantId();
    return this.svc.install(tenantId, Number(id), dto.providerId);
  }

  /** 禁用技能：仅管理员 */
  @Roles('admin')
  @Post(':id/uninstall')
  @ApiOperation({ summary: '禁用技能：仅管理员 */' })
  async uninstall(@Param('id') id: string) {
    const tenantId = TenantContext.requireTenantId();
    return this.svc.uninstall(tenantId, Number(id));
  }

  /** 改绑 Provider：仅管理员 */
  @Roles('admin')
  @Put(':id/provider')
  @ApiOperation({ summary: '改绑 Provider：仅管理员 */' })
  async setProvider(@Param('id') id: string, @Body() dto: SetProviderDto) {
    const tenantId = TenantContext.requireTenantId();
    return this.svc.setProvider(tenantId, Number(id), dto.providerId);
  }
}
