import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Roles } from '../../auth/roles.decorator';
import { TenantContext } from '../../tenant/tenant-context';
import { VideoStage, VIDEO_STAGES } from './video-automation.types';
import { VideoAutoChainService } from './auto-chain.service';
import { VideoStrategyRegistry } from './video-strategy.registry';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('video-automation')
@Controller('ops/video-automation')
export class VideoAutomationController {
  constructor(
    private readonly autoChain: VideoAutoChainService,
    private readonly registry: VideoStrategyRegistry,
  ) {}

  @Get('strategies')
  @ApiOperation({ summary: 'GET listStrategies' })
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

  /** 触发视频自动化链：消耗平台/LLM 配额，仅管理员 */
  @Roles('admin')
  @Post('run')
  @ApiOperation({ summary: '触发视频自动化链：消耗平台/LLM 配额，仅管理员 */' })
  async runOnce(@Body() body: { tenantId?: string; prefer?: Partial<Record<VideoStage, string>> }) {
    const tenantId = body.tenantId ?? TenantContext.requireTenantId();
    return this.autoChain.runOnce(tenantId, body.prefer);
  }

  /** 写入租户自动化偏好：仅管理员 */
  @Roles('admin')
  @Post('prefer')
  @ApiOperation({ summary: '写入租户自动化偏好：仅管理员 */' })
  setPref(@Body() body: { tenantId: string; pref: Partial<Record<VideoStage, string>> }) {
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
