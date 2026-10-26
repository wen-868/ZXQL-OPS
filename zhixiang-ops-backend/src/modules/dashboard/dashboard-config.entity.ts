import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';

/** 自定义看板配置（工作台 dashboard/configs；widgets 结构由前端定义） */
@Index(['tenantId'])
@Entity({ name: 'ops_dashboard_configs' })
export class DashboardConfigEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 64, comment: '看板名称' })
  name!: string;

  @Column({ type: 'json', comment: '看板组件布局（前端结构）' })
  widgets!: unknown[];
}
