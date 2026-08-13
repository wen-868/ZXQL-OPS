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
import { TenantContext } from '../../tenant/tenant-context';
import { EmployeeService } from './employee.service';
import {
  AssignRoleDto,
  CreateEmployeeDto,
  EmployeeQueryDto,
  UpdateEmployeeDto,
} from './employee.dto';

/** 员工管理（设置 → 员工管理）。路由前缀 api/ops/employees */
@Controller('ops/employees')
export class EmployeeController {
  constructor(private readonly svc: EmployeeService) {}

  @Get()
  list(@Query() q: EmployeeQueryDto) {
    return this.svc.list(q, TenantContext.requireTenantId());
  }

  /** 可选角色下拉（须早于 :id，避免被参数路由捕获） */
  @Get('roles')
  listRoles() {
    return this.svc.listRoles(TenantContext.requireTenantId());
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.svc.detail(id, TenantContext.requireTenantId());
  }

  @Post()
  create(@Body() dto: CreateEmployeeDto) {
    return this.svc.create(dto, TenantContext.requireTenantId());
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEmployeeDto) {
    return this.svc.update(id, dto, TenantContext.requireTenantId());
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.svc.remove(id, TenantContext.requireTenantId());
  }

  @Get(':id/roles')
  getRoles(@Param('id', ParseIntPipe) id: number) {
    return this.svc.getRoles(id, TenantContext.requireTenantId());
  }

  @Post(':id/roles')
  assign(@Param('id', ParseIntPipe) id: number, @Body() dto: AssignRoleDto) {
    return this.svc.assignRole(id, dto.roleId, TenantContext.requireTenantId());
  }

  @Delete(':id/roles/:roleId')
  unassign(@Param('id', ParseIntPipe) id: number, @Param('roleId', ParseIntPipe) roleId: number) {
    return this.svc.unassignRole(id, roleId, TenantContext.requireTenantId());
  }
}
