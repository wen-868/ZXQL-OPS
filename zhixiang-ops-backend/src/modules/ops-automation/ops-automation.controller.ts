import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Public } from '../../auth/public.decorator';
import { TenantContext } from '../../tenant/tenant-context';
import { OpsStage } from './ops-automation.types';
import { AutoChainService } from './auto-chain.service';
import { OpsStrategyRegistry } from './ops-strategy.registry';

@Controller('ops/automation')
export class OpsAutomationController {
  constructor(
    private readonly autoChain: AutoChainService,
    private readonly registry: OpsStrategyRegistry,
  ) {}

  @Public()
  @Get('strategies')
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

  @Public()
  @Post('run')
  async runOnce(
    @Body()
    body: {
      tenantId?: string;
      prefer?: Partial<Record<OpsStage, string>>;
    },
  ) {
    const tenantId = body.tenantId ?? TenantContext.getTenantId() ?? 't_demo';
    return this.autoChain.runOnce(tenantId, body.prefer);
  }

  @Public()
  @Post('prefer')
  setPref(@Body() body: { tenantId: string; pref: Partial<Record<OpsStage, string>> }) {
    this.autoChain.setTenantPreference(body.tenantId, body.pref);
    return { ok: true };
  }

  @Public()
  @Get('runs')
  runs() {
    return this.autoChain.listRuns();
  }
}
