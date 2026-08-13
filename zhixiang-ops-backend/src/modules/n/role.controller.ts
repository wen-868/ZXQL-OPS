import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PaginationQueryDto } from '../../shared/pagination';
import { RoleService } from './role.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignRoleDto } from './dto/assign-role.dto';

/**
 * 角色 / 权限管理接口。
 * 说明：阶段 1 MVP 登录体系尚未就绪，与既有模块保持一致——
 * 鉴权守卫（JwtAuthGuard + 权限点校验）待登录体系就绪后统一加装（见各模块注释约定）。
 * 本模块已提供 AuditService.record 供各模块落地"操作审计：全局记录"。
 */
@Controller('ops/roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Post()
  create(@Body() dto: CreateRoleDto) {
    return this.roleService.create(dto);
  }

  @Get()
  list(@Query() q: PaginationQueryDto) {
    return this.roleService.list({ page: q.page ?? 1, pageSize: q.pageSize ?? 20 });
  }

  // 必须在 :id 之前，避免 'user' 被 :id 路由匹配
  @Get('user/:userId')
  userRoles(@Param('userId') userId: string) {
    return this.roleService.getUserRoles(Number(userId));
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.roleService.get(Number(id));
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.roleService.update(Number(id), dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.roleService.remove(Number(id));
  }

  @Post(':id/assign')
  assign(@Param('id') id: string, @Body() dto: AssignRoleDto) {
    return this.roleService.assign(Number(id), dto.userId);
  }

  @Delete(':id/assign/:userId')
  unassign(@Param('id') id: string, @Param('userId') userId: string) {
    return this.roleService.unassign(Number(id), Number(userId));
  }
}
