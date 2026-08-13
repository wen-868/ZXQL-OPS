import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoleEntity } from './role.entity';
import { RoleUserEntity } from './role-user.entity';
import { AuditLogEntity } from './audit-log.entity';
import { RoleService } from './role.service';
import { AuditService } from './audit.service';
import { RoleController } from './role.controller';
import { AuditController } from './audit.controller';

/**
 * N 团队与权限模块（RBAC 角色/权限管理 + 操作审计）。
 * 导出 RoleService / AuditService 供其他模块注入复用（如各模块写操作落审计）。
 */
@Module({
  imports: [TypeOrmModule.forFeature([RoleEntity, RoleUserEntity, AuditLogEntity])],
  controllers: [RoleController, AuditController],
  providers: [RoleService, AuditService],
  exports: [RoleService, AuditService],
})
export class NModule {}
