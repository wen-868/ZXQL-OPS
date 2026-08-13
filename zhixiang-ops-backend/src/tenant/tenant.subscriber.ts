import { EventSubscriber, InsertEvent, UpdateEvent } from 'typeorm';
import { TenantContext } from './tenant-context';
import { AppError } from '../shared/app-error';

/**
 * 租户强隔离订阅器（规划 §13）。
 *
 * 设计原则：写入期强制，绝不做脆弱的 SQL 字符串改写。
 * - beforeInsert：若实体带 tenantId 列且为空，从 TenantContext 自动注入；仍为空则
 *   交数据库 NOT NULL 约束报错，不静默写空（避免跨租户串号）。
 * - beforeUpdate：禁止变更租户归属（entity.tenantId 与库中不一致即抛 TENANT_MISMATCH）。
 *
 * SELECT 的真正租户过滤在各仓库/服务层通过显式 `where({ tenantId })` 完成
 * （BaseEntity + TenantContext 提供 tenantId），是本隔离的主路径。
 */
@EventSubscriber()
export class TenantSubscriber {
  beforeInsert(event: InsertEvent<unknown>): void {
    const entity = event.entity as { tenantId?: string } | undefined;
    if (entity && typeof entity.tenantId === 'undefined') return; // 非租户实体
    if (entity && !entity.tenantId) {
      const tid = TenantContext.getTenantId();
      if (tid) entity.tenantId = tid;
    }
  }

  beforeUpdate(event: UpdateEvent<unknown>): void {
    const entity = event.entity as { tenantId?: string } | undefined;
    if (!entity || typeof entity.tenantId === 'undefined' || !entity.tenantId) return;
    const dbEntity = event.databaseEntity as { tenantId?: string } | undefined;
    if (dbEntity?.tenantId && entity.tenantId !== dbEntity.tenantId) {
      throw new AppError('TENANT_MISMATCH', '禁止跨租户更新');
    }
  }
}
