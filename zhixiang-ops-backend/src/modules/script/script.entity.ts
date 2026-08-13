import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { ComplianceRisk, ScriptStatus } from './script.types';

/**
 * 脚本实体（规划 §4-F / ops_scripts）。
 * 消费 E 选题（topicId + attributionId 透传）；仅存脚本内容/口播/字幕/合规命中，
 * 无单条个人信息落库（合规边界②）。
 */
@Entity('ops_scripts')
@Index('idx_scripts_tenant_status', ['tenantId', 'status'])
@Index('idx_scripts_tenant_topic', ['tenantId', 'topicId'])
@Index('idx_scripts_tenant_parent', ['tenantId', 'parentVersionId'])
export class ScriptEntity extends BaseEntity {
  /** 归属选题（E ops_topics.id） */
  @Column({ type: 'int' })
  topicId!: number;

  /** 归因标识：直接复用 E 选题的 attributionId，禁止在 F 重新生成（规划 §4 链路透传） */
  @Column({ type: 'varchar', length: 64 })
  attributionId!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  /** 完整脚本正文 */
  @Column({ type: 'text' })
  content!: string;

  /** 前3秒钩子段落（双轨编辑：脚本视角 vs 口播视角） */
  @Column({ type: 'text' })
  hook!: string;

  /** 钩子情绪，∈ 6 情绪（对齐 analyze.types EMOTION_TYPES） */
  @Column({ type: 'varchar', length: 32 })
  hookEmotion!: string;

  /** 口播轨（分段 [{tsStart,tsEnd,text}]） */
  @Column({ type: 'json', nullable: true })
  spokenTrack?: Array<{ tsStart: number; tsEnd: number; text: string }>;

  /** 字幕轨（分段 [{tsStart,tsEnd,text}]） */
  @Column({ type: 'json', nullable: true })
  subtitleTrack?: Array<{ tsStart: number; tsEnd: number; text: string }>;

  /** 选用模板 id（对应 SCRIPT_TEMPLATES） */
  @Column({ type: 'varchar', length: 32, nullable: true })
  templateId?: string | null;

  /** 版本号（主线自增；parentVersionId 指向父版本） */
  @Column({ type: 'int', default: 1 })
  version!: number;

  /** 父版本 id（自引用；首版为 null） */
  @Column({ type: 'int', nullable: true })
  parentVersionId?: number | null;

  @Column({ type: 'varchar', length: 32, default: ScriptStatus.Draft })
  status!: ScriptStatus;

  /** 违禁词预检风险（JSON） */
  @Column({ type: 'json', nullable: true })
  complianceRisk?: ComplianceRisk | null;

  @Column({ type: 'varchar', length: 32 })
  promptVersion!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  modelUsed?: string | null;
}
