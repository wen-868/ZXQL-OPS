import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { compare, hash } from 'bcryptjs';
import { randomBytes } from 'crypto';
import { User } from './user.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { signToken, AuthUser } from './auth-user';
import { AppError } from '../shared/app-error';
import { env } from '../config/env';
import { DemoService } from '../modules/system/demo.service';
import { verifyMsToken, MsTokenPayload } from '../integration/ms-token';
import { RoleBind } from '../integration/role-bind.entity';
import { TenantBind } from '../integration/tenant-bind.entity';

/** 运营角色权限等级（映射冲突时取最高） */
const OPS_ROLE_RANK: Record<string, number> = {
  super_admin: 3,
  ops_admin: 2,
  ops_viewer: 1,
};

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(RoleBind)
    private readonly roleBindRepo: Repository<RoleBind>,
    @InjectRepository(TenantBind)
    private readonly tenantBindRepo: Repository<TenantBind>,
    private readonly demoService: DemoService,
  ) {}

  /** 登录：校验用户名/密码，返回 token + 用户信息 */
  async login(dto: LoginDto) {
    const user = await this.userRepo.findOne({
      where: { username: dto.username },
      select: ['id', 'username', 'password', 'realName', 'role', 'tenantId', 'type'],
    });
    if (!user) throw new AppError('AUTH_USER_NOT_FOUND');
    const match = await compare(dto.password, user.password);
    if (!match) throw new AppError('AUTH_INVALID_PASSWORD');

    const payload: Omit<AuthUser, 'iat' | 'exp'> = {
      id: user.id,
      username: user.username,
      realName: user.realName,
      role: user.role,
      tenantId: user.tenantId,
      type: user.type as AuthUser['type'],
    };
    const token = signToken(payload);
    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        realName: user.realName,
        role: user.role,
        tenantId: user.tenantId,
      },
    };
  }

  /** 注册：创建用户并返回 token */
  async register(dto: RegisterDto) {
    const existing = await this.userRepo.findOne({ where: { username: dto.username } });
    if (existing) throw new AppError('AUTH_USER_EXISTS');

    const hashedPassword = await hash(dto.password, 10);
    const user = this.userRepo.create({
      username: dto.username,
      password: hashedPassword,
      realName: dto.realName ?? dto.username,
      role: dto.role ?? 'admin',
      type: 'standalone',
    });
    await this.userRepo.save(user);

    const payload: Omit<AuthUser, 'iat' | 'exp'> = {
      id: user.id,
      username: user.username,
      realName: user.realName,
      role: user.role,
      tenantId: user.tenantId,
      type: 'standalone',
    };
    const token = signToken(payload);
    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        realName: user.realName,
        role: user.role,
        tenantId: user.tenantId,
      },
    };
  }

  /**
   * 演示登录（免密）：仅当 OPS_DEMO_MODE=true 时可用。
   * 直接签发演示租户 admin 的 JWT（不校验密码），便于一键进入演示环境。
   * 演示租户与正式租户物理隔离（tenantId 不同），不影响真实业务数据。
   */
  async demoLogin() {
    if (!env.demoMode) throw new AppError('DEMO_MODE_DISABLED');
    const user = await this.demoService.ensureDemoUser();
    const payload: Omit<AuthUser, 'iat' | 'exp'> = {
      id: user.id,
      username: user.username,
      realName: user.realName,
      role: user.role,
      tenantId: user.tenantId,
      type: user.type as AuthUser['type'],
    };
    const token = signToken(payload);
    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        realName: user.realName,
        role: user.role,
        tenantId: user.tenantId,
      },
    };
  }

  /**
   * 管理系统 SSO 登录（统一管理后台方案 §4.2）。
   * - 接收管理系统 JWT（Authorization: Bearer <管理系统token>）
   * - 本地验签（同一 JWT_SECRET + issuer=zhixiang-system）
   * - 按 ops_role_bind 映射运营角色、ops_tenant_bind 映射租户
   * - 按 username 自动建号/复用（type=connected），签发运营 JWT
   */
  async sso(authorization?: string, headerTenantId?: string) {
    const token = (authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) throw new AppError('AUTH_MS_TOKEN_INVALID');

    let ms: MsTokenPayload;
    try {
      ms = verifyMsToken(token);
    } catch {
      throw new AppError('AUTH_MS_TOKEN_INVALID');
    }

    // 角色映射：取用户 roles[] 中最高权限的映射（super_admin > ops_admin > ops_viewer）
    const bindings = await this.roleBindRepo.find();
    let opsRole: string | null = null;
    let menuScope = 'ops';
    for (const msRole of ms.roles || []) {
      const bind = bindings.find((b) => b.msRole === msRole);
      if (!bind) continue;
      if (!opsRole || (OPS_ROLE_RANK[bind.opsRole] ?? 0) > (OPS_ROLE_RANK[opsRole] ?? 0)) {
        opsRole = bind.opsRole;
        menuScope = bind.menuScope;
      }
    }
    if (!opsRole) throw new AppError('AUTH_MS_ROLE_NOT_ALLOWED');

    // 租户映射：管理系统 tenantId（缺省取请求头 x-tenant-id）→ 运营租户
    const msTenantId = String(ms.tenantId ?? headerTenantId ?? '');
    const tenantBind = await this.tenantBindRepo.findOne({ where: { msTenantId } });
    if (!tenantBind || tenantBind.status !== 1) throw new AppError('SSO_TENANT_NOT_MAPPED');
    const opsTenantId = tenantBind.opsTenantId;

    // 按 username 复用或自动建号（type=connected）
    let user = await this.userRepo.findOne({ where: { username: ms.username } });
    if (user) {
      if (user.status === 0) throw new AppError('AUTH_USER_DISABLED');
      user.role = opsRole;
      user.tenantId = opsTenantId;
      user.type = 'connected';
      user.realName = ms.realName ?? user.realName ?? ms.username;
      await this.userRepo.save(user);
    } else {
      // connected 用户不可用密码登录：写入随机哈希，仅能走 SSO
      const randomPassword = await hash(randomBytes(16).toString('hex'), 10);
      user = this.userRepo.create({
        username: ms.username,
        password: randomPassword,
        realName: ms.realName ?? ms.username,
        role: opsRole,
        tenantId: opsTenantId,
        type: 'connected',
      });
      await this.userRepo.save(user);
    }

    const payload: Omit<AuthUser, 'iat' | 'exp'> = {
      id: user.id,
      username: user.username,
      realName: user.realName,
      role: user.role,
      tenantId: user.tenantId,
      type: 'connected',
    };
    const ssoToken = signToken(payload, env.OPS_SSO_TOKEN_TTL);
    return {
      token: ssoToken,
      user: {
        id: user.id,
        username: user.username,
        realName: user.realName,
        role: user.role,
        tenantId: user.tenantId,
      },
      roleBind: { opsRole, menuScope },
    };
  }

  /** 获取当前用户信息（供 /auth/me 使用） */
  async getProfile(userId: number) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new AppError('AUTH_USER_NOT_FOUND');
    const { password: _, ...profile } = user;
    return profile;
  }
}
