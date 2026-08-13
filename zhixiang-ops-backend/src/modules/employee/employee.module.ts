import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../auth/user.entity';
import { RoleEntity } from '../n/role.entity';
import { RoleUserEntity } from '../n/role-user.entity';
import { EmployeeService } from './employee.service';
import { EmployeeController } from './employee.controller';

/** 员工管理：复用登录用户表 ops_users + RBAC 角色绑定（ops_roles / ops_role_user） */
@Module({
  imports: [TypeOrmModule.forFeature([User, RoleEntity, RoleUserEntity])],
  controllers: [EmployeeController],
  providers: [EmployeeService],
})
export class EmployeeModule {}
