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
import { EmployeeService } from './employee.service';
import {
  AssignRoleDto,
  CreateEmployeeDto,
  EmployeeQueryDto,
  UpdateEmployeeDto,
} from './employee.dto';

/** 员工管理（设置 → 员工管理）。路由前缀 api/ops/employees；增删改/角色分配仅管理员 */
import { ApiOperation, ApiTags } from '@nestjs/swagger';
@ApiTags('employees')
@Controller('ops/employees')
export class EmployeeController {
  constructor(private readonly svc: EmployeeService) {}

  @Get()
  @ApiOperation({ summary: 'GET list' })
  list(@Query() q: EmployeeQueryDto) {
    return this.svc.list(q, TenantContext.requireTenantId());
  }

  /** 可选角色下拉（须早于 :id，避免被参数路由捕获） */
  @Get('roles')
  @ApiOperation({ summary: '可选角色下拉（须早于 :id，避免被参数路由捕获） */' })
  listRoles() {
    return this.svc.listRoles(TenantContext.requireTenantId());
  }

  @Get(':id')
  @ApiOperation({ summary: 'GET detail' })
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.svc.detail(id, TenantContext.requireTenantId());
  }

  @Roles('admin')
  @Post()
  @ApiOperation({ summary: 'POST create' })
  create(@Body() dto: CreateEmployeeDto) {
    return this.svc.create(dto, TenantContext.requireTenantId());
  }

  @Roles('admin')
  @Put(':id')
  @ApiOperation({ summary: 'PUT update' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEmployeeDto) {
    return this.svc.update(id, dto, TenantContext.requireTenantId());
  }

  @Roles('admin')
  @Delete(':id')
  @ApiOperation({ summary: 'DELETE remove' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.svc.remove(id, TenantContext.requireTenantId());
  }

  @Get(':id/roles')
  @ApiOperation({ summary: 'GET getRoles' })
  getRoles(@Param('id', ParseIntPipe) id: number) {
    return this.svc.getRoles(id, TenantContext.requireTenantId());
  }

  @Roles('admin')
  @Post(':id/roles')
  @ApiOperation({ summary: 'POST assign' })
  assign(@Param('id', ParseIntPipe) id: number, @Body() dto: AssignRoleDto) {
    return this.svc.assignRole(id, dto.roleId, TenantContext.requireTenantId());
  }

  @Roles('admin')
  @Delete(':id/roles/:roleId')
  @ApiOperation({ summary: 'DELETE unassign' })
  unassign(@Param('id', ParseIntPipe) id: number, @Param('roleId', ParseIntPipe) roleId: number) {
    return this.svc.unassignRole(id, roleId, TenantContext.requireTenantId());
  }
}
