import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Like, Repository } from 'typeorm';
import { hash } from 'bcryptjs';
import { AppError } from '../../shared/app-error';
import { buildPage, pageOffset } from '../../shared/pagination';
import { User } from '../../auth/user.entity';
import { RoleEntity } from '../n/role.entity';
import { RoleUserEntity } from '../n/role-user.entity';
import { CreateEmployeeDto, EmployeeQueryDto, UpdateEmployeeDto } from './employee.dto';

export interface RoleBasicView {
  id: number;
  name: string;
}
export interface EmployeeView {
  id: number;
  username: string;
  realName: string | null;
  role: string;
  type: string;
  status: number;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
  roles: RoleBasicView[];
}

const USER_SELECT = [
  'id',
  'username',
  'realName',
  'role',
  'type',
  'status',
  'tenantId',
  'createdAt',
  'updatedAt',
] as const;

@Injectable()
export class EmployeeService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
    @InjectRepository(RoleUserEntity)
    private readonly ruRepo: Repository<RoleUserEntity>,
  ) {}

  private toView(u: User, roles: RoleBasicView[] = []): EmployeeView {
    return {
      id: Number(u.id),
      username: u.username,
      realName: u.realName ?? null,
      role: u.role,
      type: u.type,
      status: u.status ?? 1,
      tenantId: u.tenantId ?? '',
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      roles,
    };
  }

  async list(q: EmployeeQueryDto, tenantId: string) {
    const { skip, take } = pageOffset(q.page, q.pageSize);
    const base: Record<string, unknown> = { tenantId };
    if (q.status !== undefined) base.status = q.status;
    const where = q.keyword
      ? [
          { ...base, username: Like(`%${q.keyword}%`) },
          { ...base, realName: Like(`%${q.keyword}%`) },
        ]
      : base;

    const [users, total] = await this.userRepo.findAndCount({
      where,
      skip,
      take,
      order: { id: 'DESC' },
      select: [...USER_SELECT],
    });

    // 批量拼装 RBAC 角色，避免 N+1
    const ids = users.map((u) => Number(u.id));
    const rus = ids.length ? await this.ruRepo.find({ where: { userId: In(ids) } }) : [];
    const roleIds = [...new Set(rus.map((r) => r.roleId))];
    const roles = roleIds.length ? await this.roleRepo.find({ where: { id: In(roleIds) } }) : [];
    const roleMap = new Map(roles.map((r) => [Number(r.id), r]));
    const grouped = new Map<number, RoleBasicView[]>();
    for (const ru of rus) {
      const arr = grouped.get(ru.userId) ?? [];
      const rl = roleMap.get(ru.roleId);
      if (rl) arr.push({ id: Number(rl.id), name: rl.name });
      grouped.set(ru.userId, arr);
    }

    const list = users.map((u) => this.toView(u, grouped.get(Number(u.id)) ?? []));
    return buildPage(list, total, q.page, q.pageSize);
  }

  async listRoles(tenantId: string) {
    const roles = await this.roleRepo.find({ where: { tenantId }, order: { id: 'ASC' } });
    return roles.map((r) => ({
      id: Number(r.id),
      name: r.name,
      description: r.description ?? null,
      isSystem: r.isSystem,
    }));
  }

  async create(dto: CreateEmployeeDto, tenantId: string): Promise<EmployeeView> {
    const existing = await this.userRepo.findOne({ where: { username: dto.username } });
    if (existing) throw new AppError('AUTH_USER_EXISTS');

    const user = this.userRepo.create({
      username: dto.username,
      password: await hash(dto.password, 10),
      realName: dto.realName ?? dto.username,
      role: dto.role ?? 'editor',
      type: 'standalone',
      tenantId,
      status: dto.status ?? 1,
    });
    const saved = await this.userRepo.save(user);
    return this.toView(saved);
  }

  async update(id: number, dto: UpdateEmployeeDto, tenantId: string): Promise<EmployeeView> {
    const user = await this.userRepo.findOne({ where: { id, tenantId }, select: [...USER_SELECT] });
    if (!user) throw new AppError('AUTH_USER_NOT_FOUND');

    if (dto.realName !== undefined) user.realName = dto.realName ?? undefined;
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.status !== undefined) user.status = dto.status;
    if (dto.password) user.password = await hash(dto.password, 10);

    const saved = await this.userRepo.save(user);
    return this.toView(saved);
  }

  async remove(id: number, tenantId: string): Promise<{ id: number }> {
    const user = await this.userRepo.findOne({ where: { id, tenantId } });
    if (!user) throw new AppError('AUTH_USER_NOT_FOUND');
    await this.ruRepo.delete({ userId: id });
    await this.userRepo.remove(user);
    return { id };
  }

  async detail(id: number, tenantId: string) {
    const user = await this.userRepo.findOne({ where: { id, tenantId }, select: [...USER_SELECT] });
    if (!user) throw new AppError('AUTH_USER_NOT_FOUND');
    const { roles } = await this.getRoles(id, tenantId);
    return { ...this.toView(user), roles };
  }

  async getRoles(
    id: number,
    tenantId: string,
  ): Promise<{ userId: number; roles: RoleBasicView[] }> {
    const user = await this.userRepo.findOne({ where: { id, tenantId } });
    if (!user) throw new AppError('AUTH_USER_NOT_FOUND');

    const rus = await this.ruRepo.find({ where: { userId: id } });
    const roleIds = [...new Set(rus.map((r) => r.roleId))];
    const roles = roleIds.length
      ? await this.roleRepo.find({ where: { id: In(roleIds), tenantId } })
      : [];
    return {
      userId: id,
      roles: roles.map((r) => ({ id: Number(r.id), name: r.name })),
    };
  }

  async assignRole(id: number, roleId: number, tenantId: string) {
    const user = await this.userRepo.findOne({ where: { id, tenantId } });
    if (!user) throw new AppError('AUTH_USER_NOT_FOUND');
    const role = await this.roleRepo.findOne({ where: { id: roleId, tenantId } });
    if (!role) throw new AppError('ROLE_NOT_FOUND');

    const exist = await this.ruRepo.findOne({ where: { tenantId, userId: id, roleId } });
    if (exist) throw new AppError('ROLE_ASSIGN_DUP');

    const ru = this.ruRepo.create({ tenantId, userId: id, roleId });
    await this.ruRepo.save(ru);
    return { userId: id, roleId };
  }

  async unassignRole(id: number, roleId: number, tenantId: string) {
    const ru = await this.ruRepo.findOne({ where: { tenantId, userId: id, roleId } });
    if (!ru) throw new AppError('ROLE_USER_NOT_FOUND');
    await this.ruRepo.remove(ru);
    return { userId: id, roleId };
  }
}
