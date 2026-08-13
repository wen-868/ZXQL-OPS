import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';

/** 大模型提供方类型：本地 Ollama / OpenAI 兼容 / Azure OpenAI / 自定义兼容端点 */
export type LlmProviderType = 'ollama' | 'openai' | 'azure' | 'custom';

/**
 * 大模型提供方配置（运营系统「设置 → 大模型配置」）。
 * 与技能中心 skill_providers（BYO 绑定）解耦：本表是通用的 LLM 提供方注册表，
 * 供脚本生成 / 素材成片 / 智能客服等需要调用 LLM 的链路读取默认通道。
 * apiKey 加密存储（encryptSecret），对外仅暴露掩码。
 */
@Entity({ name: 'ops_llm_providers' })
export class LlmProviderEntity extends BaseEntity {
  @Column({ name: 'name', type: 'varchar', length: 120, comment: '提供方名称' })
  name!: string;

  @Column({ name: 'type', type: 'varchar', length: 32, comment: '提供方类型' })
  type!: LlmProviderType;

  @Column({
    name: 'base_url',
    type: 'varchar',
    length: 512,
    nullable: true,
    comment: 'API 基础地址',
  })
  baseUrl?: string | null;

  @Column({
    name: 'api_key_enc',
    type: 'varchar',
    length: 1024,
    nullable: true,
    comment: 'API Key（加密存储）',
  })
  apiKeyEnc?: string | null;

  @Column({
    name: 'default_model',
    type: 'varchar',
    length: 120,
    nullable: true,
    comment: '默认模型',
  })
  defaultModel?: string | null;

  @Column({ name: 'enabled', type: 'tinyint', width: 1, default: 1, comment: '是否启用' })
  enabled!: number;

  @Column({ name: 'remark', type: 'varchar', length: 255, nullable: true, comment: '备注' })
  remark?: string | null;
}
