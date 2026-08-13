import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RecycleService } from './recycle.service';
import { CreateRecycleDto } from './dto/create-recycle.dto';

/**
 * 数据监控与回收控制器（规划 §4-J / 开发顺序第8步）。
 * 路由前缀 ops（全局前缀 api → /api/ops/*）。
 * 租户隔离由服务层 TenantContext.requireTenantId() 强约束；响应由全局拦截器包装为 {code,msg,data,traceId}。
 */
@Controller('ops')
export class RecycleController {
  constructor(private readonly recycleService: RecycleService) {}

  /** POST /api/ops/recycle — 发起回收（消费 I 发布数据回流） */
  @Post('recycle')
  createRecycle(@Body() dto: CreateRecycleDto) {
    return this.recycleService.createRecycle(dto);
  }

  /** GET /api/ops/recycle/:id — 回收任务进度 */
  @Get('recycle/:id')
  getRecycle(@Param('id') id: string) {
    return this.recycleService.getRecycle(Number(id));
  }

  /** GET /api/ops/feedback/:video_id — 单视频回收明细（含回流再分析状态） */
  @Get('feedback/:videoId')
  getFeedback(@Param('videoId') videoId: string) {
    return this.recycleService.getFeedback(Number(videoId));
  }

  /** POST /api/ops/analysis/rerun — 回收评论回流 D 再分析（re_analysis_id 闭环） */
  @Post('analysis/rerun')
  rerunAnalysis() {
    return this.recycleService.rerunAnalysis();
  }
}
