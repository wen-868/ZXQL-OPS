import { Body, Controller, Get, Param, Post, Query, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { WorkflowService } from './workflow.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { PaginationQueryDto } from '../../shared/pagination';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

/**
 * 工作流编排控制器（规划 §4-L）。
 * 路由前缀 ops（全局前缀 api → /api/ops/...）。
 * 租户隔离由服务层 TenantContext.requireTenantId() 强约束。
 */
@ApiTags('ops')
@Controller('ops')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Post('workflows')
  @ApiOperation({ summary: 'POST createDef' })
  createDef(@Body() dto: CreateWorkflowDto) {
    return this.workflowService.createDef(dto);
  }

  @Get('workflows')
  @ApiOperation({ summary: 'GET listDefs' })
  listDefs(@Query() query: PaginationQueryDto) {
    return this.workflowService.listDefs(query);
  }

  @Post('workflows/:id')
  @ApiOperation({ summary: 'POST updateDef' })
  updateDef(@Param('id') id: string, @Body() dto: UpdateWorkflowDto) {
    return this.workflowService.updateDef(Number(id), dto);
  }

  @Post('workflows/:id/run')
  @ApiOperation({ summary: 'POST run' })
  run(@Param('id') id: string) {
    return this.workflowService.run(Number(id));
  }

  @Get('workflow-runs/:id/stream')
  @ApiOperation({ summary: 'GET 接口' })
  @Sse()
  streamRun(@Param('id') id: string): Observable<{ data: any }> {
    return this.workflowService.streamRun(Number(id));
  }
}
