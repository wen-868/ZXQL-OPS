import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppError } from '../../shared/app-error';
import { encryptSecret, decryptSecret } from '../../shared/crypto';
import { SystemConfigEntity } from './system-config.entity';

/** 配置键白名单：客户可自助维护的系统级配置（新增配置先在此登记） */
export const CONFIG_KEY_DEFS: Record<
  string,
  { description: string; sensitive: boolean; fallback?: string }
> = {
  // 抖音开放平台 OAuth 凭据（B 域账号授权；未配置时自动走 Sandbox 演示链路）
  'oauth.douyin.appId': { description: '抖音开放平台 client_key', sensitive: false },
  'oauth.douyin.appSecret': { description: '抖音开放平台 client_secret', sensitive: true },
};

/** 对外展示对象：敏感值一律掩码 */
export interface SystemConfigView {
  key: string;
  value: string;
  masked: boolean;
  description?: string;
  updatedAt: Date;
}

/** 读取视图：解密后的值（仅服务内部使用） */
export interface SystemConfigResolved {
  key: string;
  value: string;
}

const MASK = '******';

@Injectable()
export class SystemConfigService {
  private readonly logger = new Logger(SystemConfigService.name);

  constructor(
    @InjectRepository(SystemConfigEntity)
    private readonly repo: Repository<SystemConfigEntity>,
  ) {}

  private static assertKey(key: string): void {
    if (!(key in CONFIG_KEY_DEFS)) {
      throw new AppError('INVALID_PARAM', `未知配置键: ${key}`);
    }
  }

  /** 读取单个配置（敏感值解密）。未配置时返回 fallback 或空串 */
  async get(key: string): Promise<string> {
    SystemConfigService.assertKey(key);
    const def = CONFIG_KEY_DEFS[key];
    const row = await this.repo.findOne({ where: { key } });
    if (!row) return def.fallback ?? '';
    return def.sensitive && row.valueEnc ? decryptSecret(row.valueEnc) : (row.valueText ?? '');
  }

  /** 批量读取（避免 N 次查询） */
  async getMany(keys: string[]): Promise<Record<string, string>> {
    const rows = await this.repo.find({ where: keys.map((k) => ({ key: k })) });
    const map = new Map(rows.map((r) => [r.key, r]));
    const out: Record<string, string> = {};
    for (const key of keys) {
      const def = CONFIG_KEY_DEFS[key];
      const row = map.get(key);
      if (!row) {
        out[key] = def?.fallback ?? '';
        continue;
      }
      out[key] =
        def?.sensitive && row.valueEnc ? decryptSecret(row.valueEnc) : (row.valueText ?? '');
    }
    return out;
  }

  /** 写入配置（敏感值加密存储；传空字符串视为清除该配置） */
  async set(key: string, value: string): Promise<SystemConfigView> {
    SystemConfigService.assertKey(key);
    const def = CONFIG_KEY_DEFS[key];
    const normalized = value.trim();
    const existing = await this.repo.findOne({ where: { key } });
    if (existing) {
      if (def.sensitive) {
        existing.valueEnc = normalized ? encryptSecret(normalized) : null;
        existing.valueText = null;
      } else {
        existing.valueText = normalized || null;
        existing.valueEnc = null;
      }
      existing.isSensitive = def.sensitive;
      await this.repo.save(existing);
    } else {
      await this.repo.save(
        this.repo.create({
          key,
          isSensitive: def.sensitive,
          valueEnc: def.sensitive && normalized ? encryptSecret(normalized) : undefined,
          valueText: !def.sensitive ? normalized || null : undefined,
        } as Partial<SystemConfigEntity>),
      );
    }
    this.logger.log(`系统配置已更新: ${key}${normalized ? '' : '（已清除）'}`);
    return this.toView(key, normalized);
  }

  /** 配置列表（敏感值掩码展示） */
  async list(): Promise<SystemConfigView[]> {
    const rows = await this.repo.find({ order: { key: 'ASC' } });
    const byKey = new Map(rows.map((r) => [r.key, r]));
    return Object.entries(CONFIG_KEY_DEFS).map(([key, def]) => {
      const row = byKey.get(key);
      return {
        key,
        value: row ? (def.sensitive ? MASK : (row.valueText ?? '')) : '',
        masked: def.sensitive && !!row,
        description: def.description,
        updatedAt: row?.updatedAt ?? new Date(0),
      };
    });
  }

  private toView(key: string, value: string): SystemConfigView {
    const def = CONFIG_KEY_DEFS[key];
    return {
      key,
      value: def.sensitive ? MASK : value,
      masked: def.sensitive,
      description: def.description,
      updatedAt: new Date(),
    };
  }
}
