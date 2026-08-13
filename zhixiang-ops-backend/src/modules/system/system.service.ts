import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { hash } from 'bcryptjs';
import { User } from '../../auth/user.entity';
import { RoleEntity } from '../n/role.entity';
import {
  ComplianceWordEntity,
  type ComplianceWordLevel,
  type ComplianceWordAction,
} from '../compliance/compliance-word.entity';
import { TenantContext } from '../../tenant/tenant-context';
import { DemoService } from './demo.service';
import { env } from '../../config/env';
import { InitDeployDto, SeedDataDto } from './system.dto';

export interface SystemStatus {
  initialized: boolean;
  adminExists: boolean;
  roleCount: number;
  complianceWordCount: number;
  demoMode: boolean;
}

export interface InitStep {
  step: string;
  status: 'created' | 'skipped';
  detail?: string;
}

const ADMIN_PERMISSIONS = [
  'account:read',
  'account:write',
  'intel:read',
  'intel:write',
  'analyze:read',
  'analyze:write',
  'topic:read',
  'topic:write',
  'script:read',
  'script:write',
  'publish:read',
  'publish:write',
  'workflow:read',
  'workflow:write',
  'recycle:read',
  'recycle:write',
  'dashboard:read',
  'selection:read',
  'selection:write',
  'product:read',
  'product:write',
  'live:read',
  'live:write',
  'ad:read',
  'ad:write',
  'order:read',
  'order:write',
  'cs:read',
  'cs:write',
  'role:read',
  'role:write',
  'role:manage',
  'audit:read',
  'employee:read',
  'employee:write',
  'system:manage',
  'llm:manage',
  'compliance:manage',
];
const EDITOR_PERMISSIONS = [
  'account:read',
  'account:write',
  'intel:read',
  'intel:write',
  'analyze:read',
  'analyze:write',
  'topic:read',
  'topic:write',
  'script:read',
  'script:write',
  'publish:read',
  'publish:write',
  'workflow:read',
  'workflow:write',
  'recycle:read',
  'recycle:write',
  'dashboard:read',
  'selection:read',
  'selection:write',
  'product:read',
  'product:write',
  'live:read',
  'live:write',
  'ad:read',
  'ad:write',
  'order:read',
  'order:write',
  'cs:read',
  'cs:write',
];
const VIEWER_PERMISSIONS = [
  'account:read',
  'intel:read',
  'analyze:read',
  'topic:read',
  'script:read',
  'publish:read',
  'workflow:read',
  'recycle:read',
  'dashboard:read',
  'selection:read',
  'product:read',
  'live:read',
  'ad:read',
  'order:read',
  'cs:read',
];

const DEFAULT_ROLES = [
  {
    name: 'admin',
    description: '系统管理员（全部权限）',
    permissions: ADMIN_PERMISSIONS,
    isSystem: true,
  },
  {
    name: 'editor',
    description: '运营编辑（业务读写）',
    permissions: EDITOR_PERMISSIONS,
    isSystem: true,
  },
  {
    name: 'viewer',
    description: '只读访客（业务查看）',
    permissions: VIEWER_PERMISSIONS,
    isSystem: true,
  },
];

interface BaselineWord {
  word: string;
  category: string;
  level: ComplianceWordLevel;
  action: ComplianceWordAction;
}
const BASELINE_WORDS: BaselineWord[] = [
  { word: '国家级', category: '广告法', level: 'high', action: 'block' },
  { word: '世界级', category: '广告法', level: 'high', action: 'block' },
  { word: '最高级', category: '广告法', level: 'high', action: 'block' },
  { word: '最强', category: '广告法', level: 'high', action: 'block' },
  { word: '最佳', category: '广告法', level: 'medium', action: 'warn' },
  { word: '第一', category: '广告法', level: 'medium', action: 'warn' },
  { word: '唯一', category: '广告法', level: 'medium', action: 'warn' },
  { word: '绝对', category: '广告法', level: 'medium', action: 'warn' },
  { word: '100%', category: '广告法', level: 'high', action: 'block' },
  { word: '万能', category: '广告法', level: 'medium', action: 'warn' },
  { word: '永久', category: '广告法', level: 'medium', action: 'warn' },
  { word: '零风险', category: '医疗', level: 'high', action: 'block' },
  { word: '包治百病', category: '医疗', level: 'high', action: 'block' },
  { word: '立即赚钱', category: '营销', level: 'high', action: 'block' },
  { word: '免费领取', category: '营销', level: 'low', action: 'warn' },
];

@Injectable()
export class SystemService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
    @InjectRepository(ComplianceWordEntity)
    private readonly wordRepo: Repository<ComplianceWordEntity>,
    private readonly demoService: DemoService,
  ) {}

  async getStatus(): Promise<SystemStatus> {
    const tenantId = TenantContext.requireTenantId();
    const adminExists = (await this.userRepo.count({ where: { tenantId, role: 'admin' } })) > 0;
    const roleCount = await this.roleRepo.count({ where: { tenantId } });
    const complianceWordCount = await this.wordRepo.count({ where: { tenantId } });
    const initialized = adminExists && roleCount >= DEFAULT_ROLES.length;
    return { initialized, adminExists, roleCount, complianceWordCount, demoMode: env.demoMode };
  }

  async initDeploy(dto: InitDeployDto): Promise<{ initialized: boolean; steps: InitStep[] }> {
    const tenantId = dto.tenantId || TenantContext.requireTenantId();
    const steps: InitStep[] = [];
    // 系统初始化：演示模式下先清除演示数据，保证正式环境干净；
    // 非演示模式（生产）不触碰业务数据，避免误删真实数据。
    if (env.demoMode) {
      const cleared = await this.demoService.clearDemoData();
      steps.push({
        step: 'clear-demo-data',
        status: cleared > 0 ? 'created' : 'skipped',
        detail: `已清除演示数据 ${cleared} 行`,
      });
    } else {
      steps.push({
        step: 'clear-demo-data',
        status: 'skipped',
        detail: '非演示模式，跳过演示数据清除',
      });
    }
    const baseline = await this.ensureBaseline(
      tenantId,
      ['roles', 'admin', 'compliance-words'],
      dto,
    );
    steps.push(...baseline);
    return { initialized: true, steps };
  }

  async seedData(dto: SeedDataDto): Promise<{ steps: InitStep[] }> {
    const tenantId = TenantContext.requireTenantId();
    const domains =
      dto.domains && dto.domains.length ? dto.domains : ['roles', 'admin', 'compliance-words'];
    const steps = await this.ensureBaseline(tenantId, domains, {});
    return { steps };
  }

  /** 幂等基线初始化：各域已存在则跳过，不删除现有数据 */
  private async ensureBaseline(
    tenantId: string,
    domains: string[],
    dto: InitDeployDto = {},
  ): Promise<InitStep[]> {
    const steps: InitStep[] = [];
    if (domains.includes('roles')) steps.push(await this.ensureDefaultRoles(tenantId));
    if (domains.includes('admin')) steps.push(await this.ensureAdmin(tenantId, dto));
    if (domains.includes('compliance-words'))
      steps.push(await this.ensureComplianceBaseline(tenantId));
    return steps;
  }

  private async ensureDefaultRoles(tenantId: string): Promise<InitStep> {
    let created = 0;
    for (const r of DEFAULT_ROLES) {
      const exist = await this.roleRepo.findOne({ where: { tenantId, name: r.name } });
      if (exist) continue;
      await this.roleRepo.save(
        this.roleRepo.create({
          tenantId,
          name: r.name,
          description: r.description,
          permissions: r.permissions,
          isSystem: r.isSystem,
        }),
      );
      created++;
    }
    return {
      step: 'default-roles',
      status: created > 0 ? 'created' : 'skipped',
      detail: created > 0 ? `已创建 ${created} 个默认角色` : '默认角色已存在',
    };
  }

  private async ensureAdmin(tenantId: string, dto: InitDeployDto): Promise<InitStep> {
    const username = dto.adminUsername || 'admin';
    const exist = await this.userRepo.findOne({ where: { username } });
    if (exist) {
      return { step: 'admin-account', status: 'skipped', detail: `管理员账号 ${username} 已存在` };
    }
    const user = this.userRepo.create({
      username,
      password: await hash(dto.adminPassword || 'Admin@123', 10),
      realName: dto.adminRealName || '系统管理员',
      role: 'admin',
      type: 'standalone',
      tenantId,
      status: 1,
    });
    await this.userRepo.save(user);
    return { step: 'admin-account', status: 'created', detail: `已创建管理员账号 ${username}` };
  }

  private async ensureComplianceBaseline(tenantId: string): Promise<InitStep> {
    let created = 0;
    for (const w of BASELINE_WORDS) {
      const exist = await this.wordRepo.findOne({ where: { tenantId, word: w.word } });
      if (exist) continue;
      await this.wordRepo.save(
        this.wordRepo.create({
          tenantId,
          word: w.word,
          category: w.category,
          level: w.level,
          action: w.action,
          enabled: true,
        }),
      );
      created++;
    }
    return {
      step: 'compliance-words',
      status: created > 0 ? 'created' : 'skipped',
      detail: created > 0 ? `已补录 ${created} 条基线违禁词` : '合规词库基线已存在',
    };
  }
}
