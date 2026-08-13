import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { SkillType } from '../../skill/skill.types';

/**
 * 技能目录（规划 §4-Z / ⑦ 技能中心）。
 * 系统内置的 5 类技能市场条目：text/video/image/voice/digital-human。
 * tenantId 固定为 'system'（技能目录为运营系统级共享资产，不按租户隔离）。
 */
@Entity({ name: 'skills' })
export class SkillCatalog extends BaseEntity {
  @Column({ type: 'varchar', length: 32, comment: '技能类型(对应 SkillGateway 技能枚举)' })
  type!: SkillType;

  @Column({ type: 'varchar', length: 64, comment: '技能名称' })
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true, comment: '技能描述' })
  description?: string;

  @Column({ name: 'builtin', type: 'boolean', default: true, comment: '是否系统内置技能' })
  builtin!: boolean;

  @Column({ name: 'enabled', type: 'boolean', default: true, comment: '系统级是否上架(总开关)' })
  enabled!: boolean;
}
