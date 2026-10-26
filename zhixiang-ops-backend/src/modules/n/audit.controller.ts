import { Controller, Get, Query } from '@nestjs/common';
import { PaginationQueryDto } from '../../shared/pagination';
import { Roles } from '../../auth/roles.decorator';
import { AuditService } from './audit.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

/**
 * 操作审计查询接口（规划 N 消费契约"操作审计：全局记录"只读侧）。
 * 审计写入由 AuditService.record 供各业务模块内部调用，不暴露 HTTP 写入口。
 * 仅管理员可查询审计记录。
 */
@Roles('admin')
@ApiTags('audit')
@Controller('ops/audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'GET query' })
  query(@Query() q: PaginationQueryDto & { module?: string; action?: string; userId?: string }) {
    return this.auditService.query({
      page: q.page ?? 1,
      pageSize: q.pageSize ?? 20,
      module: q.module,
      action: q.action,
      userId: q.userId ? Number(q.userId) : undefined,
    });
  }
}
