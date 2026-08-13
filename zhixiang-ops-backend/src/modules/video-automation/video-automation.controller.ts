import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Public } from '../../auth/public.decorator';
import { TenantContext } from '../../tenant/tenant-context';
import { VideoStage, VIDEO_STAGES } from './video-automation.types';
import { VideoAutoChainService } from './auto-chain.service';
import { VideoStrategyRegistry } from './video-strategy.registry';

@Controller('ops/video-automation')
export class VideoAutomationController {
  constructor(
    private readonly autoChain: VideoAutoChainService,
    private readonly registry: VideoStrategyRegistry,
  ) {}

  @Public()
  @Get('strategies')
  listStrategies(@Query('stage') stage?: VideoStage) {
    if (stage) {
      return {
        stage,
        count: this.registry.countByStage(stage),
        strategies: this.registry.metasByStage(stage),
      };
    }
    return VIDEO_STAGES.map((s) => ({
      stage: s,
      count: this.registry.countByStage(s),
      strategies: this.registry.metasByStage(s),
    }));
  }

  @Public()
  @Post('run')
  async runOnce(@Body() body: { tenantId?: string; prefer?: Partial<Record<VideoStage, string>> }) {
    const tenantId = body.tenantId ?? TenantContext.getTenantId() ?? 't_demo';
    return this.autoChain.runOnce(tenantId, body.prefer);
  }

  @Public()
  @Post('prefer')
  setPref(@Body() body: { tenantId: string; pref: Partial<Record<VideoStage, string>> }) {
    this.autoChain.setTenantPreference(body.tenantId, body.pref);
    return { ok: true };
  }

  @Public()
  @Get('runs')
  runs() {
    return this.autoChain.listRuns();
  }
}
