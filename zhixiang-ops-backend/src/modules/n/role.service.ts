import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppError } from '../../shared/app-error';
import { TenantContext } from '../../tenant/tenant-context';
import { buildPage, pageOffset } from '../../shared/pagination';
import { RoleEntity } from './role.entity';
import { RoleUserEntity } from './role-user.entity';
import { AuditService } from './audit.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RoleView } from './n.types';

/**
 * 角色服务（RBAC）。
 * 负责角色 CRUD、用户-角色绑定、权限合并查询，并对关键写操作落审计。
 * ownerId/tenantId 一律从 TenantContext 强隔离获取（见 requireTenantId）。
 */
@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
    @InjectRepository(RoleUserEntity)
    private readonly roleUserRepo: Repository<RoleUserEntity>,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateRoleDto): Promise<RoleView> {
    const tenantId = TenantContext.requireTenantId();
    const existed = await this.roleRepo.findOne({ where: { tenantId, name: dto.name } });
    if (existed) {
      throw new AppError('ROLE_DUPLICATE');
    }
    const entity = this.roleRepo.create({
      tenantId,
      name: dto.name,
      description: dto.description,
      permissions: dto.permissions ?? [],
      isSystem: false,
    } as Partial<RoleEntity>);
    const saved = await this.roleRepo.save(entity);
    await this.audit.record({
      action: 'create_role',
      module: 'role',
      resource: `roleId:${saved.id}`,
    });
    return this.toView(saved);
  }

  async list(query: { page: number; pageSize: number }): Promise<{
    list: RoleView[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const tenantId = TenantContext.requireTenantId();
    const { skip, take } = pageOffset(query.page, query.pageSize);
    const [rows, total] = await this.roleRepo.findAndCount({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      skip,
      take,
    });
    return buildPage(
      rows.map((r) => this.toView(r)),
      total,
      query.page,
      query.pageSize,
    );
  }

  async get(id: number): Promise<RoleView> {
    const tenantId = TenantContext.requireTenantId();
    const entity = await this.roleRepo.findOne({ where: { id, tenantId } });
    if (!entity) {
      throw new AppError('ROLE_NOT_FOUND');
    }
    return this.toView(entity);
  }

  async update(id: number, dto: UpdateRoleDto): Promise<RoleView> {
    const tenantId = TenantContext.requireTenantId();
    const entity = await this.roleRepo.findOne({ where: { id, tenantId } });
    if (!entity) {
      throw new AppError('ROLE_NOT_FOUND');
    }
    if (dto.name !== undefined) entity.name = dto.name;
    if (dto.description !== undefined) entity.description = dto.description;
    if (dto.permissions !== undefined) entity.permissions = dto.permissions;
    const saved = await this.roleRepo.save(entity);
    await this.audit.record({
      action: 'update_role',
      module: 'role',
      resource: `roleId:${id}`,
    });
    return this.toView(saved);
  }

  async remove(id: number): Promise<{ id: number }> {
    const tenantId = TenantContext.requireTenantId();
    const entity = await this.roleRepo.findOne({ where: { id, tenantId } });
    if (!entity) {
      throw new AppError('ROLE_NOT_FOUND');
    }
    if (entity.isSystem) {
      throw new AppError('ROLE_SYSTEM_PROTECTED');
    }
    // 级联移除用户绑定（按 tenantId + roleId 软删）
    await this.roleUserRepo.softDelete({ tenantId, roleId: id });
    await this.roleRepo.softDelete({ id, tenantId });
    await this.audit.record({
      action: 'delete_role',
      module: 'role',
      resource: `roleId:${id}`,
    });
    return { id };
  }

  async assign(id: number, userId: number): Promise<{ roleId: number; userId: number }> {
    const tenantId = TenantContext.requireTenantId();
    const role = await this.roleRepo.findOne({ where: { id, tenantId } });
    if (!role) {
      throw new AppError('ROLE_NOT_FOUND');
    }
    const dup = await this.roleUserRepo.findOne({ where: { tenantId, userId, roleId: id } });
    if (dup) {
      throw new AppError('ROLE_ASSIGN_DUP');
    }
    await this.roleUserRepo.save(
      this.roleUserRepo.create({ tenantId, userId, roleId: id } as Partial<RoleUserEntity>),
    );
    await this.audit.record({
      action: 'assign_role',
      module: 'role',
      resource: `roleId:${id};userId:${userId}`,
    });
    return { roleId: id, userId };
  }

  async unassign(id: number, userId: number): Promise<{ roleId: number; userId: number }> {
    const tenantId = TenantContext.requireTenantId();
    const role = await this.roleRepo.findOne({ where: { id, tenantId } });
    if (!role) {
      throw new AppError('ROLE_NOT_FOUND');
    }
    const bound = await this.roleUserRepo.findOne({ where: { tenantId, userId, roleId: id } });
    if (!bound) {
      throw new AppError('ROLE_USER_NOT_FOUND');
    }
    await this.roleUserRepo.softDelete({ tenantId, userId, roleId: id });
    await this.audit.record({
      action: 'unassign_role',
      module: 'role',
      resource: `roleId:${id};userId:${userId}`,
    });
    return { roleId: id, userId };
  }

  /** 查询用户拥有的全部角色及合并去重后的权限集合 */
  async getUserRoles(
    userId: number,
  ): Promise<{ userId: number; roles: RoleView[]; permissions: string[] }> {
    const tenantId = TenantContext.requireTenantId();
    const bindings = await this.roleUserRepo.find({ where: { tenantId, userId } });
    if (bindings.length === 0) {
      return { userId, roles: [], permissions: [] };
    }
    const roleIds = bindings.map((b) => b.roleId);
    const roles = await this.roleRepo.find({
      where: roleIds.map((rid) => ({ tenantId, id: rid })),
    });
    const views = roles.map((r) => this.toView(r));
    const permissions = Array.from(new Set(views.flatMap((r) => r.permissions)));
    return { userId, roles: views, permissions };
  }

  private toView(e: RoleEntity): RoleView {
    return {
      id: e.id,
      name: e.name,
      description: e.description,
      permissions: e.permissions ?? [],
      isSystem: e.isSystem,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    };
  }
}
