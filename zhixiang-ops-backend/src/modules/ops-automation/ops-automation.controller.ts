import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Roles } from '../../auth/roles.decorator';
import { TenantContext } from '../../tenant/tenant-context';
import { OpsStage } from './ops-automation.types';
import { AutoChainService } from './auto-chain.service';
import { OpsStrategyRegistry } from './ops-strategy.registry';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('automation')
@Controller('ops/automation')
export class OpsAutomationController {
  constructor(
    private readonly autoChain: AutoChainService,
    private readonly registry: OpsStrategyRegistry,
  ) {}

  @Get('strategies')
  @ApiOperation({ summary: 'GET listStrategies' })
  listStrategies(@Query('stage') stage?: OpsStage) {
    if (stage) {
      return {
        stage,
        count: this.registry.countByStage(stage),
        strategies: this.registry.metasByStage(stage),
      };
    }
    const all = (['retrieve', 'screen', 'publish-up', 'deliver', 'verify'] as OpsStage[]).map(
      (s) => ({
        stage: s,
        count: this.registry.countByStage(s),
        strategies: this.registry.metasByStage(s),
      }),
    );
    return all;
  }

  /** 触发自动化链（可指定阶段子集，如只跑第一段 检索→筛选）：消耗平台/LLM 配额，仅管理员 */
  @Roles('admin')
  @Post('run')
  @ApiOperation({
    summary:
      '触发自动化链（可指定阶段子集，如只跑第一段 检索→筛选）：消耗平台/LLM 配额，仅管理员 */',
  })
  async runOnce(
    @Body()
    body: {
      tenantId?: string;
      prefer?: Partial<Record<OpsStage, string>>;
      stages?: OpsStage[];
    },
  ) {
    const tenantId = body.tenantId ?? TenantContext.requireTenantId();
    return this.autoChain.runOnce(tenantId, body.prefer, body.stages);
  }

  /** 写入租户自动化偏好：仅管理员 */
  @Roles('admin')
  @Post('prefer')
  @ApiOperation({ summary: '写入租户自动化偏好：仅管理员 */' })
  setPref(@Body() body: { tenantId: string; pref: Partial<Record<OpsStage, string>> }) {
    const tenantId = body.tenantId ?? TenantContext.requireTenantId();
    this.autoChain.setTenantPreference(tenantId, body.pref);
    return { ok: true };
  }

  @Get('runs')
  @ApiOperation({ summary: 'GET runs' })
  runs() {
    return this.autoChain.listRuns();
  }
}
