import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantContext } from '../../tenant/tenant-context';
import { buildPage, pageOffset } from '../../shared/pagination';
import { AuditLogEntity } from './audit-log.entity';
import { AuditLogView } from './n.types';

export interface AuditRecordInput {
  action: string;
  module: string;
  resource?: string;
  userId?: number;
  traceId?: string;
}

/**
 * 操作审计服务（规划 N 消费契约"操作审计：全局记录"）。
 * 由各业务模块注入后调用 record() 写审计；本服务自身导出供全局复用。
 */
@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditRepo: Repository<AuditLogEntity>,
  ) {}

  /**
   * 记录一条操作审计。
   * userId / traceId 缺省从 TenantContext 透传（有登录体系时自动带出）。
   */
  async record(input: AuditRecordInput): Promise<AuditLogEntity> {
    const tenantId = TenantContext.requireTenantId();
    const ctx = TenantContext.current();
    const entity = this.auditRepo.create({
      tenantId,
      userId: input.userId ?? ctx?.userId,
      action: input.action,
      module: input.module,
      resource: input.resource,
      traceId: input.traceId ?? ctx?.traceId,
      ts: new Date(),
    } as Partial<AuditLogEntity>);
    return this.auditRepo.save(entity);
  }

  /** 查询本租户审计（分页 + 可选 module/action/userId 过滤），按 ts 降序 */
  async query(query: {
    page: number;
    pageSize: number;
    module?: string;
    action?: string;
    userId?: number;
  }): Promise<{ list: AuditLogView[]; total: number; page: number; pageSize: number }> {
    const tenantId = TenantContext.requireTenantId();
    const { skip, take } = pageOffset(query.page, query.pageSize);
    const qb = this.auditRepo
      .createQueryBuilder('a')
      .where('a.tenant_id = :tenantId', { tenantId });
    if (query.module) {
      qb.andWhere('a.module = :module', { module: query.module });
    }
    if (query.action) {
      qb.andWhere('a.action = :action', { action: query.action });
    }
    if (query.userId !== undefined) {
      qb.andWhere('a.user_id = :userId', { userId: query.userId });
    }
    qb.orderBy('a.ts', 'DESC').skip(skip).take(take);
    const [rows, total] = await qb.getManyAndCount();
    return buildPage(
      rows.map((r) => this.toView(r)),
      total,
      query.page,
      query.pageSize,
    );
  }

  private toView(e: AuditLogEntity): AuditLogView {
    return {
      id: e.id,
      userId: e.userId,
      action: e.action,
      module: e.module,
      resource: e.resource,
      traceId: e.traceId,
      ts: e.ts,
    };
  }
}
