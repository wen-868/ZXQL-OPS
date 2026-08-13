import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ScriptService } from './script.service';
import { GenerateScriptDto } from './dto/generate-script.dto';
import { UpdateScriptDto } from './dto/update-script.dto';
import { ScriptQueryDto } from './dto/script-query.dto';
import { ComplianceCheckDto } from './dto/compliance-check.dto';
import { VersionScriptDto } from './dto/version-script.dto';

/**
 * 脚本工坊控制器（规划 §4-F）。
 * 路由前缀 ops/script（全局前缀 api → /api/ops/script）。
 * 租户隔离由服务层 TenantContext.requireTenantId() 强约束。
 */
@Controller('ops/script')
export class ScriptController {
  constructor(private readonly scriptService: ScriptService) {}

  @Post('generate')
  generateScript(@Body() dto: GenerateScriptDto) {
    return this.scriptService.generateScript(dto);
  }

  @Get('scripts')
  listScripts(@Query() query: ScriptQueryDto) {
    return this.scriptService.listScripts(query);
  }

  @Get('scripts/:id')
  getScript(@Param('id') id: string) {
    return this.scriptService.getScript(Number(id));
  }

  @Put('scripts/:id')
  updateScript(@Param('id') id: string, @Body() dto: UpdateScriptDto) {
    return this.scriptService.updateScript(Number(id), dto);
  }

  @Post('scripts/:id/check')
  checkCompliance(@Param('id') id: string, @Body() dto: ComplianceCheckDto) {
    return this.scriptService.checkCompliance(Number(id), dto);
  }

  @Post('scripts/:id/version')
  versionScript(@Param('id') id: string, @Body() dto: VersionScriptDto) {
    return this.scriptService.versionScript(Number(id), dto);
  }

  @Get('templates')
  listTemplates() {
    return this.scriptService.listTemplates();
  }
}
