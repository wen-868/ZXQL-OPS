import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';

/**
 * 数字人形象（规划 §4-K）。
 * - 管理形象/音色；话术绑定 F 脚本（后续阶段）、实时渲染推流（第三方默认）。
 */
@Entity({ name: 'ops_digital_humans' })
@Index(['tenantId', 'status'])
export class DigitalHumanEntity extends BaseEntity {
  @Column({ name: 'name', type: 'varchar', length: 128, comment: '数字人名称' })
  name!: string;

  @Column({ name: 'avatar', type: 'varchar', length: 512, nullable: true, comment: '形象URL' })
  avatar?: string | null;

  @Column({ name: 'voice', type: 'varchar', length: 128, nullable: true, comment: '音色标识' })
  voice?: string | null;

  @Column({ name: 'status', type: 'varchar', length: 32, default: 'active', comment: '状态' })
  status!: string;
}
