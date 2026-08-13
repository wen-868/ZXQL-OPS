import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';

/** 仪表盘配置（规划 §4-M / ops_dashboards）。每租户可建多条，widgets 存组件配置 JSON */
@Entity('ops_dashboards')
@Index('idx_dashboards_tenant', ['tenantId'])
export class DashboardEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 128, comment: '仪表盘名称' })
  name!: string;

  /** 组件配置：[{ type, title, props }]，供前端 BI 看板渲染 */
  @Column({ type: 'json', nullable: true, comment: '组件配置数组' })
  widgets?: Array<Record<string, unknown>> | null;
}
