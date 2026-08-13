import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../database/base.entity';
import { SkillType } from './skill.types';

/**
 * 租户技能 Provider 配置（规划 §4-O / Z 技能中心）。
 * - 系统默认 Provider（local-ollama / 外部）由运营系统内置，tenant_id 可为系统占位。
 * - 租户 BYO（自建 Provider）按 tenant 读取 api_key（加密存储）。
 */
@Entity({ name: 'skill_providers' })
export class SkillProviderEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 32, comment: '技能类型' })
  type!: SkillType;

  @Column({ type: 'varchar', length: 64, comment: 'Provider 名称' })
  name!: string;

  @Column({
    type: 'varchar',
    length: 32,
    comment: '来源: local-ollama/external/tenant-byo',
  })
  source!: string;

  /** API Key 加密存储（BYO 外部源），本地源为空 */
  @Column({ name: 'api_key_enc', type: 'text', nullable: true, comment: '加密后的 API Key' })
  apiKeyEnc?: string;

  /** OpenAI 兼容接口基址（BYO 外部源必填；本地源为空） */
  @Column({
    name: 'base_url',
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: 'OpenAI 兼容接口基址（BYO）',
  })
  baseUrl?: string;

  /** 支持的模型列表（JSON 数组） */
  @Column({ name: 'models', type: 'json', nullable: true, comment: '可用模型列表' })
  models?: string[];

  @Column({ name: 'is_default', type: 'boolean', default: false, comment: '是否系统默认' })
  isDefault!: boolean;

  @Column({ name: 'enabled', type: 'boolean', default: true, comment: '是否启用' })
  enabled!: boolean;
}
