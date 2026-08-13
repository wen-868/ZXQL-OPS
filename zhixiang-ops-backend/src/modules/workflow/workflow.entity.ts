import { BaseEntity } from '../../database/base.entity';
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import {
  WorkflowNode,
  WorkflowEdge,
  WorkflowTrigger,
  WorkflowRunStatus,
  WorkflowNodeLogStatus,
} from './workflow.types';

/** 编排定义（规划 §4-L / ops_workflow_defs） */
@Entity('ops_workflow_defs')
@Index('idx_wf_def_tenant', ['tenantId'])
export class WorkflowDefEntity extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 128 })
  name!: string;

  /** 节点：{id,type,config}[] */
  @Column({ type: 'json' })
  nodes!: WorkflowNode[];

  /** 边：{from,to,condition?}[] */
  @Column({ type: 'json' })
  edges!: WorkflowEdge[];

  @Column({ type: 'varchar', length: 16, default: 'manual' })
  trigger!: WorkflowTrigger;

  @Column({ type: 'varchar', length: 64, nullable: true })
  cronExpr?: string | null;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;
}

/** 运行实例（规划 §4-L / ops_workflow_runs） */
@Entity('ops_workflow_runs')
@Index('idx_wf_run_tenant_def', ['tenantId', 'defId'])
export class WorkflowRunEntity extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  defId!: number;

  @Column({ type: 'varchar', length: 16, default: 'queued' })
  status!: WorkflowRunStatus;

  @Column({ type: 'int', default: 0 })
  progress!: number;

  @Column({ type: 'datetime', nullable: true })
  startedAt?: Date | null;

  @Column({ type: 'datetime', nullable: true })
  finishedAt?: Date | null;
}

/** 运行节点日志（规划 §4-L / ops_workflow_run_logs） */
@Entity('ops_workflow_run_logs')
@Index('idx_wf_log_tenant_run', ['tenantId', 'runId'])
export class WorkflowRunLogEntity extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  runId!: number;

  @Column({ type: 'varchar', length: 64 })
  nodeId!: string;

  @Column({ type: 'varchar', length: 16 })
  nodeType!: string;

  @Column({ type: 'varchar', length: 16, default: 'running' })
  status!: WorkflowNodeLogStatus;

  @Column({ type: 'json', nullable: true })
  input?: Record<string, any> | null;

  @Column({ type: 'json', nullable: true })
  output?: Record<string, any> | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  traceId?: string | null;
}
