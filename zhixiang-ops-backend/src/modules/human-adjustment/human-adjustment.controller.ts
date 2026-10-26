import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { HumanAdjustmentService } from './human-adjustment.service';
import { Humanity } from '../../core/humanity-emotion';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('human-adjustment')
@Controller('ops/human-adjustment')
export class HumanAdjustmentController {
  constructor(private readonly adjustmentService: HumanAdjustmentService) {}

  /** POST /api/ops/human-adjustment/human-driver — 人性驱动微调 */
  @Post('human-driver')
  @ApiOperation({ summary: '人性驱动微调 */' })
  async adjustHumanDriver(
    @Body()
    body: {
      targetType: 'topic' | 'script' | 'product';
      targetId: number;
      fromHumanDriver: Humanity;
      toHumanDriver: Humanity;
      operator: string;
      reason: string;
    },
  ) {
    return this.adjustmentService.adjustHumanDriver({
      targetType: body.targetType,
      targetId: body.targetId,
      fromHumanDriver: body.fromHumanDriver,
      toHumanDriver: body.toHumanDriver,
      operator: body.operator,
      reason: body.reason,
    });
  }

  /** POST /api/ops/human-adjustment/skill-params — 技能参数微调 */
  @Post('skill-params')
  @ApiOperation({ summary: '技能参数微调 */' })
  async adjustSkillParams(
    @Body()
    body: {
      skillName: string;
      parameterChanges: Record<string, unknown>;
      operator: string;
      reason: string;
    },
  ) {
    return this.adjustmentService.adjustSkillParams({
      skillName: body.skillName,
      parameterChanges: body.parameterChanges,
      operator: body.operator,
      reason: body.reason,
    });
  }

  /** POST /api/ops/human-adjustment/thresholds — 阈值微调 */
  @Post('thresholds')
  @ApiOperation({ summary: '阈值微调 */' })
  async adjustThresholds(
    @Body()
    body: {
      thresholdType: 'publish' | 'inventory' | 'compliance';
      newValue: number | string;
      operator: string;
      reason: string;
    },
  ) {
    return this.adjustmentService.adjustThresholds({
      thresholdType: body.thresholdType,
      newValue: body.newValue,
      operator: body.operator,
      reason: body.reason,
    });
  }

  /** GET /api/ops/human-adjustment/history — 调整历史 */
  @Get('history')
  @ApiOperation({ summary: '调整历史 */' })
  async getAdjustmentHistory(
    @Query() query: { page?: number; pageSize?: number; targetType?: string; targetId?: number },
  ) {
    return this.adjustmentService.getAdjustmentHistory({
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      targetType: query.targetType,
      targetId: query.targetId,
    });
  }
}
