import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppError } from '../../shared/app-error';
import { encryptSecret, decryptSecret } from '../../shared/crypto';
import { SkillType } from '../../skill/skill.types';
import { SkillProviderEntity } from '../../skill/skill-provider.entity';
import { AuditService } from '../n/audit.service';
import { SkillCatalog } from './skill-catalog.entity';
import { SkillInstall } from './skill-install.entity';
import { CreateProviderDto } from './dto/create-provider.dto';

const SYSTEM_TENANT = 'system';

/** 技能市场条目（含本租户启用态） */
export interface SkillMarketItem {
  id: number;
  type: SkillType;
  name: string;
  description?: string;
  builtin: boolean;
  systemEnabled: boolean;
  installed: boolean;
  enabled: boolean;
  providerId?: number;
}

/** 已启用技能（门禁/拓扑查询用） */
export interface InstalledSkill {
  skillId: number;
  type: SkillType;
  name: string;
  providerId?: number;
}

/**
 * 技能中心服务（规划 §4-Z / ⑦ 管理平面）。
 * - 维护系统内置技能目录（首次 lazy-seed 5 类）。
 * - 租户维度启用/禁用技能、绑定 Provider（系统默认 or 自建 BYO）。
 * - 提供 isEnabled 门禁供 SkillGateway 调用（未启用技能不在系统暴露）。
 * 与 ③ 能力网关联动：Z 决定"装什么/用哪个源"，网关负责路由+降级+源透明。
 */
@Injectable()
export class SkillCenterService implements OnModuleInit {
  private readonly logger = new Logger(SkillCenterService.name);

  private readonly BUILTIN: ReadonlyArray<{ type: SkillType; name: string; description: string }> =
    [
      { type: 'text-generate', name: '文本生成', description: '脚本/标题/文案/客服话术等文本生成' },
      { type: 'image-generate', name: '图像生成', description: '素材/封面/海报等图像生成' },
      { type: 'video-generate', name: '视频生成', description: 'AI 画面/成片生成' },
      { type: 'voice-clone', name: '音色克隆', description: '配音/数字人音色克隆' },
      { type: 'digital-human', name: '数字人', description: '数字人形象驱动与推流' },
    ];

  constructor(
    @InjectRepository(SkillCatalog)
    private readonly skillRepo: Repository<SkillCatalog>,
    @InjectRepository(SkillInstall)
    private readonly installRepo: Repository<SkillInstall>,
    @InjectRepository(SkillProviderEntity)
    private readonly providerRepo: Repository<SkillProviderEntity>,
    private readonly audit: AuditService,
  ) {}

  /** 应用启动即 lazy-seed 内置技能目录（保证技能市场非空） */
  async onModuleInit(): Promise<void> {
    await this.ensureSeeded();
  }

  /** 首次 lazy-seed 内置技能目录与默认 Provider（幂等） */
  async ensureSeeded(): Promise<void> {
    const count = await this.skillRepo.count();
    if (count === 0) {
      for (const b of this.BUILTIN) {
        await this.skillRepo.save(
          this.skillRepo.create({
            tenantId: SYSTEM_TENANT,
            type: b.type,
            name: b.name,
            description: b.description,
            builtin: true,
            enabled: true,
          } as Partial<SkillCatalog>),
        );
      }
      this.logger.log(`技能目录已 seed ${this.BUILTIN.length} 类内置技能`);
    }
    const providerCount = await this.providerRepo.count();
    if (providerCount === 0) {
      for (const b of this.BUILTIN) {
        await this.providerRepo.save(
          this.providerRepo.create({
            tenantId: SYSTEM_TENANT,
            type: b.type,
            name: `本地 ${b.name}`,
            source: 'local-ollama',
            enabled: true,
            isDefault: true,
          } as Partial<SkillProviderEntity>),
        );
      }
      this.logger.log(`已 seed ${this.BUILTIN.length} 个本地默认 Provider`);
    }
  }

  /** 技能市场：列出系统内置技能 + 本租户启用态 */
  async getMarket(tenantId: string): Promise<SkillMarketItem[]> {
    const skills = await this.skillRepo.find({ where: { tenantId: SYSTEM_TENANT } });
    const installs = await this.installRepo.find({ where: { tenantId } });
    const bySkill = new Map(installs.map((i) => [i.skillId, i]));
    return skills.map((s) => {
      const ins = bySkill.get(s.id);
      return {
        id: s.id,
        type: s.type,
        name: s.name,
        description: s.description,
        builtin: s.builtin,
        systemEnabled: s.enabled,
        installed: !!ins,
        enabled: ins?.enabled ?? false,
        providerId: ins?.providerId,
      };
    });
  }

  /** 本租户已启用技能列表（门禁/拓扑用） */
  async getInstalled(tenantId: string): Promise<InstalledSkill[]> {
    const installs = await this.installRepo.find({ where: { tenantId, enabled: true } });
    const out: InstalledSkill[] = [];
    for (const ins of installs) {
      const skill = await this.skillRepo.findOne({
        where: { id: ins.skillId, tenantId: SYSTEM_TENANT },
      });
      if (skill) {
        out.push({
          skillId: skill.id,
          type: skill.type,
          name: skill.name,
          providerId: ins.providerId,
        });
      }
    }
    return out;
  }

  /** 启用技能（可一并绑定 Provider）；已存在则更新 */
  async install(tenantId: string, skillId: number, providerId?: number): Promise<SkillMarketItem> {
    const skill = await this.requireSkill(skillId);
    if (!skill.enabled) {
      throw new AppError('SKILL_NOT_AVAILABLE', '该技能系统未上架，不可启用');
    }
    if (providerId) {
      await this.requireProvider(providerId, tenantId);
    }
    const existing = await this.installRepo.findOne({ where: { tenantId, skillId } });
    if (existing) {
      existing.enabled = true;
      if (providerId !== undefined) existing.providerId = providerId;
      await this.installRepo.save(existing);
    } else {
      await this.installRepo.save(
        this.installRepo.create({
          tenantId,
          skillId,
          providerId,
          enabled: true,
        } as Partial<SkillInstall>),
      );
    }
    await this.audit.record({
      action: 'skill_install',
      module: 'skill-center',
      resource: `skill:${skillId}`,
    });
    return this.toMarketItem(skill, true, true, providerId);
  }

  /** 禁用技能（逻辑停用，保留绑定历史） */
  async uninstall(tenantId: string, skillId: number): Promise<SkillMarketItem> {
    const skill = await this.requireSkill(skillId);
    const existing = await this.installRepo.findOne({ where: { tenantId, skillId } });
    if (existing) {
      existing.enabled = false;
      await this.installRepo.save(existing);
    }
    await this.audit.record({
      action: 'skill_uninstall',
      module: 'skill-center',
      resource: `skill:${skillId}`,
    });
    return this.toMarketItem(skill, !!existing, false, existing?.providerId);
  }

  /** 改绑 Provider（系统默认或自建 BYO） */
  async setProvider(
    tenantId: string,
    skillId: number,
    providerId: number,
  ): Promise<SkillMarketItem> {
    const skill = await this.requireSkill(skillId);
    const provider = await this.requireProvider(providerId, tenantId);
    const existing = await this.installRepo.findOne({ where: { tenantId, skillId } });
    if (!existing) {
      throw new AppError('SKILL_NOT_INSTALLED', '请先启用该技能再绑定 Provider');
    }
    existing.providerId = provider.id;
    await this.installRepo.save(existing);
    await this.audit.record({
      action: 'skill_set_provider',
      module: 'skill-center',
      resource: `skill:${skillId}/provider:${providerId}`,
    });
    return this.toMarketItem(skill, true, existing.enabled, providerId);
  }

  /** 门禁：租户是否启用某技能类型（供 SkillGateway 调用） */
  async isEnabled(tenantId: string, skill: SkillType): Promise<boolean> {
    const catalog = await this.skillRepo.findOne({
      where: { tenantId: SYSTEM_TENANT, type: skill },
    });
    if (!catalog || !catalog.enabled) return false;
    const install = await this.installRepo.findOne({
      where: { tenantId, skillId: catalog.id, enabled: true },
    });
    return !!install;
  }

  /** 本租户可绑定的 Provider 列表（系统默认 + 自建 BYO） */
  async listProviders(tenantId: string): Promise<SkillProviderEntity[]> {
    return this.providerRepo.find({
      where: [
        { tenantId: SYSTEM_TENANT, enabled: true },
        { tenantId, enabled: true },
      ],
    });
  }

  /**
   * 网关路由解析：租户绑定在该技能上的 BYO/外部 Provider。
   * 返回 { provider, apiKey }（apiKey 已解密）；未绑定或为本地源时返回 null。
   */
  async resolveByoProvider(
    tenantId: string,
    skill: SkillType,
  ): Promise<{ provider: SkillProviderEntity; apiKey: string } | null> {
    const catalog = await this.skillRepo.findOne({
      where: { tenantId: SYSTEM_TENANT, type: skill },
    });
    if (!catalog) return null;
    const install = await this.installRepo.findOne({
      where: { tenantId, skillId: catalog.id, enabled: true },
    });
    if (!install?.providerId) return null;
    const provider = await this.providerRepo.findOne({
      where: [
        { id: install.providerId, tenantId: SYSTEM_TENANT, enabled: true },
        { id: install.providerId, tenantId, enabled: true },
      ],
    });
    if (!provider) return null;
    // 本地 Ollama 等本地源已有本地实现，不做 HTTP 包装；BYO 必须提供 baseUrl
    if (provider.source === 'local-ollama' || !provider.apiKeyEnc || !provider.baseUrl) return null;
    return { provider, apiKey: decryptSecret(provider.apiKeyEnc) };
  }

  /** 创建 Provider（租户 BYO / 外部源），API Key 加密存储 */
  async createProvider(tenantId: string, dto: CreateProviderDto): Promise<SkillProviderEntity> {
    const saved = await this.providerRepo.save(
      this.providerRepo.create({
        tenantId,
        type: dto.type,
        name: dto.name,
        source: dto.source ?? 'tenant-byo',
        apiKeyEnc: dto.apiKey ? encryptSecret(dto.apiKey) : undefined,
        baseUrl: dto.baseUrl,
        models: dto.models ?? [],
        enabled: true,
        isDefault: false,
      } as Partial<SkillProviderEntity>),
    );
    await this.audit.record({
      action: 'provider_create',
      module: 'skill-center',
      resource: `provider:${saved.id}`,
    });
    return saved;
  }

  /** 删除 Provider（软删）；被技能绑定中禁止删除 */
  async deleteProvider(tenantId: string, providerId: number): Promise<{ id: number }> {
    await this.requireProvider(providerId, tenantId);
    const bound = await this.installRepo.findOne({ where: { tenantId, providerId } });
    if (bound) {
      throw new AppError('PROVIDER_BOUND', '该 Provider 正被技能绑定，请先解绑再删除');
    }
    await this.providerRepo.softDelete({ id: providerId, tenantId });
    await this.audit.record({
      action: 'provider_delete',
      module: 'skill-center',
      resource: `provider:${providerId}`,
    });
    return { id: providerId };
  }

  private async requireSkill(skillId: number): Promise<SkillCatalog> {
    const skill = await this.skillRepo.findOne({ where: { id: skillId, tenantId: SYSTEM_TENANT } });
    if (!skill) throw new AppError('SKILL_NOT_FOUND', '技能不存在');
    return skill;
  }

  private async requireProvider(
    providerId: number,
    tenantId: string,
  ): Promise<SkillProviderEntity> {
    const provider = await this.providerRepo.findOne({
      where: [
        { id: providerId, tenantId: SYSTEM_TENANT, enabled: true },
        { id: providerId, tenantId, enabled: true },
      ],
    });
    if (!provider) throw new AppError('PROVIDER_NOT_FOUND', 'Provider 不存在或不可绑定');
    return provider;
  }

  private toMarketItem(
    skill: SkillCatalog,
    installed: boolean,
    enabled: boolean,
    providerId?: number,
  ): SkillMarketItem {
    return {
      id: skill.id,
      type: skill.type,
      name: skill.name,
      description: skill.description,
      builtin: skill.builtin,
      systemEnabled: skill.enabled,
      installed,
      enabled,
      providerId,
    };
  }
}
