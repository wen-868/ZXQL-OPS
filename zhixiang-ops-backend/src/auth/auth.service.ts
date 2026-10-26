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
import { LoginRateLimitService } from '../cache/login-rate-limit.service';
import { issueCsrfToken } from './csrf';

/** 运营角色权限等级（映射冲突时取最高） */
const OPS_ROLE_RANK: Record<string, number> = {
  super_admin: 3,
  ops_admin: 2,
  ops_viewer: 1,
};

/** 未登记的角色等级记 0（不参与优先级比较） */
function roleRank(opsRole: string): number {
  return OPS_ROLE_RANK[opsRole] ?? 0;
}

/** 候选绑定是否优于当前最优：无当前最优时直接胜出；同级不覆盖（先命中者优先） */
function isHigherBind(current: RoleBind | null, candidate: RoleBind): boolean {
  return !current || roleRank(candidate.opsRole) > roleRank(current.opsRole);
}

/** 从 Authorization 头提取 Bearer token（缺省一律视为空串） */
function bearerToken(authorization?: string): string {
  return (authorization || '').replace(/^Bearer\s+/i, '').trim();
}

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
    /** 登录防爆破（Redis + 内存兜底，覆盖 login/register/sso/demo-login 全部入口） */
    private readonly rateLimit: LoginRateLimitService,
  ) {}

  /** 登录：校验用户名/密码，返回 token + 用户信息 + CSRF 令牌 */
  async login(dto: LoginDto, ip = 'unknown') {
    const key = LoginRateLimitService.key(ip, dto.username);
    await this.rateLimit.assertAllowed(key);
    const user = await this.userRepo.findOne({
      where: { username: dto.username },
      select: ['id', 'username', 'password', 'realName', 'role', 'tenantId', 'type'],
    });
    if (!user) {
      await this.rateLimit.recordFailure(key);
      throw new AppError('AUTH_USER_NOT_FOUND');
    }
    const match = await compare(dto.password, user.password);
    if (!match) {
      await this.rateLimit.recordFailure(key);
      throw new AppError('AUTH_INVALID_PASSWORD');
    }

    await this.rateLimit.reset(key);
    return this.buildSession(user);
  }

  /** 注册：创建用户并返回 token（受 OPS_ALLOW_REGISTER 开关控制；失败计数与登录共用限流键） */
  async register(dto: RegisterDto, ip = 'unknown') {
    // 开放注册开关：生产环境建议关闭（注册走管理员邀请/员工管理）
    if (!env.allowRegister) {
      throw new AppError('REGISTER_DISABLED');
    }
    const key = LoginRateLimitService.key(ip, dto.username);
    await this.rateLimit.assertAllowed(key);
    const existing = await this.userRepo.findOne({ where: { username: dto.username } });
    if (existing) {
      await this.rateLimit.recordFailure(key);
      throw new AppError('AUTH_USER_EXISTS');
    }

    const hashedPassword = await hash(dto.password, 10);
    const user = this.userRepo.create({
      username: dto.username,
      password: hashedPassword,
      realName: dto.realName ?? dto.username,
      // 开放注册默认最低权限 viewer；升级角色需管理员操作（员工管理/角色分配）
      role: dto.role ?? 'viewer',
      type: 'standalone',
    });
    await this.userRepo.save(user);

    await this.rateLimit.reset(key);
    return this.buildSession(user);
  }

  /**
   * 演示登录（免密）：仅当 OPS_DEMO_MODE=true 时可用。
   * 直接签发演示租户 admin 的 JWT（不校验密码），便于一键进入演示环境。
   * 演示租户与正式租户物理隔离（tenantId 不同），不影响真实业务数据。
   */
  async demoLogin(ip = 'unknown') {
    const key = LoginRateLimitService.key(ip, 'demo');
    await this.rateLimit.assertAllowed(key);
    if (!env.demoMode) {
      await this.rateLimit.recordFailure(key);
      throw new AppError('DEMO_MODE_DISABLED');
    }
    const user = await this.demoService.ensureDemoUser();
    await this.rateLimit.reset(key);
    return this.buildSession(user);
  }

  /**
   * 管理系统 SSO 登录（统一管理后台方案 §4.2）。
   * - 接收管理系统 JWT（Authorization: Bearer <管理系统token>）
   * - 本地验签（同一 JWT_SECRET + issuer=zhixiang-system）
   * - 按 ops_role_bind 映射运营角色、ops_tenant_bind 映射租户
   * - 按 username 自动建号/复用（type=connected），签发运营 JWT
   */
  async sso(authorization?: string, headerTenantId?: string, ip = 'unknown') {
    const key = LoginRateLimitService.key(ip, 'sso');
    await this.rateLimit.assertAllowed(key);
    const token = bearerToken(authorization);
    if (!token) {
      await this.rateLimit.recordFailure(key);
      throw new AppError('AUTH_MS_TOKEN_INVALID');
    }

    const ms = await this.verifyMs(token, ip);
    const { opsRole, menuScope } = await this.resolveOpsRole(ms, ip);
    const opsTenantId = await this.resolveOpsTenant(ms, headerTenantId ?? '', ip);

    const { user, userKey } = await this.upsertSsoUser(ms, opsRole, opsTenantId, ip);

    await this.rateLimit.reset(userKey);
    return {
      ...this.buildSession(user, env.OPS_SSO_TOKEN_TTL),
      roleBind: { opsRole, menuScope },
    };
  }

  /** 角色映射：取用户 roles[] 中最高权限的映射（super_admin > ops_admin > ops_viewer）；无映射则拒绝 */
  private async resolveOpsRole(
    ms: MsTokenPayload,
    ip: string,
  ): Promise<{ opsRole: string; menuScope: string }> {
    const bindings = await this.roleBindRepo.find();
    let bind: RoleBind | null = null;
    for (const msRole of ms.roles || []) {
      const hit = bindings.find((b) => b.msRole === msRole);
      if (hit && isHigherBind(bind, hit)) bind = hit;
    }
    if (!bind) {
      await this.rateLimit.recordFailure(LoginRateLimitService.key(ip, ms.username));
      throw new AppError('AUTH_MS_ROLE_NOT_ALLOWED');
    }
    return { opsRole: bind.opsRole, menuScope: bind.menuScope };
  }

  /** 本地验签管理系统 JWT：验签失败统一转 AUTH_MS_TOKEN_INVALID（不泄漏验签细节） */
  private async verifyMs(token: string, ip: string): Promise<MsTokenPayload> {
    try {
      return verifyMsToken(token);
    } catch {
      await this.rateLimit.recordFailure(LoginRateLimitService.key(ip, 'sso'));
      throw new AppError('AUTH_MS_TOKEN_INVALID');
    }
  }

  /** 租户映射：管理系统 tenantId（缺省取请求头 x-tenant-id）→ 运营租户；未映射或非启用态则拒绝 */
  private async resolveOpsTenant(ms: MsTokenPayload, headerTenantId: string, ip: string) {
    const msTenantId = String(ms.tenantId ?? headerTenantId ?? '');
    const tenantBind = await this.tenantBindRepo.findOne({ where: { msTenantId } });
    if (!tenantBind || tenantBind.status !== 1) {
      await this.rateLimit.recordFailure(LoginRateLimitService.key(ip, ms.username));
      throw new AppError('SSO_TENANT_NOT_MAPPED');
    }
    return tenantBind.opsTenantId;
  }

  /** 按 username 复用或自动建号（type=connected，随机密码不可密码登录） */
  private async upsertSsoUser(
    ms: MsTokenPayload,
    opsRole: string,
    opsTenantId: string,
    ip: string,
  ) {
    const userKey = LoginRateLimitService.key(ip, ms.username);
    let user = await this.userRepo.findOne({ where: { username: ms.username } });
    if (user) {
      if (user.status === 0) {
        await this.rateLimit.recordFailure(userKey);
        throw new AppError('AUTH_USER_DISABLED');
      }
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
    return { user, userKey };
  }

  /** 获取当前用户信息（供 /auth/me 使用） */
  async getProfile(userId: number) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new AppError('AUTH_USER_NOT_FOUND');
    const { password: _, ...profile } = user;
    return profile;
  }

  /**
   * 组装登录响应：签发 JWT + CSRF 令牌 + 对外可见用户信息。
   * payload 即 user 投影（type 取 user.type），login/register/demoLogin/sso 共用，
   * 避免四处维护漂移；sso 通过 expiresIn 传自定义 TTL。
   */
  private buildSession(user: User, expiresIn?: number | string) {
    const payload: Omit<AuthUser, 'iat' | 'exp'> = {
      id: user.id,
      username: user.username,
      realName: user.realName,
      role: user.role,
      tenantId: user.tenantId,
      type: user.type as AuthUser['type'],
    };
    return {
      token: signToken(payload, expiresIn),
      csrfToken: issueCsrfToken(user.id, user.tenantId),
      user: {
        id: user.id,
        username: user.username,
        realName: user.realName,
        role: user.role,
        tenantId: user.tenantId,
      },
    };
  }

  /** 为已登录用户签发/刷新 CSRF 令牌（供 /auth/csrf-token，覆盖门户 SSO 等无登录响应的场景） */
  issueCsrf(userId: number, tenantId?: string): string {
    return issueCsrfToken(userId, tenantId);
  }
}
