import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { VideoService } from './h.service';
import { FromScriptDto, EditVideoDto } from './dto';

/**
 * 智能成片控制器（规划 §4-H / 开发顺序 H 智能成片 / 阶段3 增强）。
 * 路由前缀 ops（全局前缀 api → /api/ops/*）。租户隔离由服务层强约束。
 */
@Controller('ops')
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  /** POST /api/ops/videos/from-script — 脚本转分镜+成片 */
  @Post('videos/from-script')
  fromScript(@Body() dto: FromScriptDto) {
    return this.videoService.fromScript(dto);
  }

  /** POST /api/ops/videos/:id/edit — AI 自动剪辑/模板化 */
  @Post('videos/:id/edit')
  edit(@Param('id') id: string, @Body() dto: EditVideoDto) {
    return this.videoService.editVideo(Number(id), dto);
  }

  /** POST /api/ops/videos/:id/review — 送审+合规预检 */
  @Post('videos/:id/review')
  review(@Param('id') id: string) {
    return this.videoService.reviewVideo(Number(id));
  }

  /** GET /api/ops/videos — 视频库 */
  @Get('videos')
  list() {
    return this.videoService.listVideos();
  }
}
