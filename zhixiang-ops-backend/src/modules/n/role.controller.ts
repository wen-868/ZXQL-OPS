import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PaginationQueryDto } from '../../shared/pagination';
import { Roles } from '../../auth/roles.decorator';
import { RoleService } from './role.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

/**
 * 角色 / 权限管理接口。仅管理员可访问（角色分配影响全局权限边界）。
 */
@Roles('admin')
@ApiTags('roles')
@Controller('ops/roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Post()
  @ApiOperation({ summary: 'POST create' })
  create(@Body() dto: CreateRoleDto) {
    return this.roleService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'GET list' })
  list(@Query() q: PaginationQueryDto) {
    return this.roleService.list({ page: q.page ?? 1, pageSize: q.pageSize ?? 20 });
  }

  // 必须在 :id 之前，避免 'user' 被 :id 路由匹配
  @Get('user/:userId')
  @ApiOperation({ summary: 'GET userRoles' })
  userRoles(@Param('userId') userId: string) {
    return this.roleService.getUserRoles(Number(userId));
  }

  @Get(':id')
  @ApiOperation({ summary: 'GET get' })
  get(@Param('id') id: string) {
    return this.roleService.get(Number(id));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'PATCH update' })
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.roleService.update(Number(id), dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'DELETE remove' })
  remove(@Param('id') id: string) {
    return this.roleService.remove(Number(id));
  }

  @Post(':id/assign')
  @ApiOperation({ summary: 'POST assign' })
  assign(@Param('id') id: string, @Body() dto: AssignRoleDto) {
    return this.roleService.assign(Number(id), dto.userId);
  }

  @Delete(':id/assign/:userId')
  @ApiOperation({ summary: 'DELETE unassign' })
  unassign(@Param('id') id: string, @Param('userId') userId: string) {
    return this.roleService.unassign(Number(id), Number(userId));
  }
}
