import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';

/**
 * 租户技能安装/启用绑定（规划 §4-Z / ⑦ 技能中心）。
 * 记录某租户是否启用某技能，以及绑定哪个 Provider（空=系统默认，有值=自建 BYO）。
 */
@Entity({ name: 'skill_installs' })
export class SkillInstall extends BaseEntity {
  @Column({ name: 'skill_id', type: 'bigint', unsigned: true, comment: '关联 skills.id' })
  skillId!: number;

  @Column({
    name: 'provider_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
    comment: '绑定 Provider(skill_providers.id)；空=使用系统默认 Provider',
  })
  providerId?: number;

  @Column({ name: 'enabled', type: 'boolean', default: true, comment: '租户是否启用该技能' })
  enabled!: boolean;
}
