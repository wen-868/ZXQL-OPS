import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { LiveService } from './live.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { CreateDigitalHumanDto } from './dto/create-digital-human.dto';
import { DanmuAiReplyDto } from './dto/danmu-ai-reply.dto';
import { ReportStatDto } from './dto/report-stat.dto';
import { ok } from '../../shared/response';
import { AppError } from '../../shared/app-error';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('live')
@Controller('ops/live')
export class LiveController {
  constructor(private readonly live: LiveService) {}

  @Post('rooms')
  @ApiOperation({ summary: 'POST createRoom' })
  async createRoom(@Body() dto: CreateRoomDto) {
    return ok(await this.live.createRoom(dto));
  }

  @Post('rooms/:id/start')
  @ApiOperation({ summary: 'POST startRoom' })
  async startRoom(@Param('id') id: string) {
    return ok(await this.live.startRoom(Number(id)));
  }

  @Post('rooms/:id/end')
  @ApiOperation({ summary: 'POST endRoom' })
  async endRoom(@Param('id') id: string) {
    return ok(await this.live.endRoom(Number(id)));
  }

  @Post('rooms/:id/push')
  @ApiOperation({ summary: 'POST pushStream' })
  async pushStream(@Param('id') id: string, @Body('rtmpUrl') rtmpUrl: string) {
    if (!rtmpUrl) throw new AppError('LIVE_RTMP_URL_REQUIRED');
    return ok(await this.live.pushStream(Number(id), rtmpUrl));
  }

  @Get('rooms/:id')
  @ApiOperation({ summary: 'GET getRoom' })
  async getRoom(@Param('id') id: string) {
    return ok(await this.live.getRoom(Number(id)));
  }

  @Get('rooms/:id/stats')
  @ApiOperation({ summary: 'GET getStats' })
  async getStats(@Param('id') id: string) {
    return ok(await this.live.getStats(Number(id)));
  }

  @Post('rooms/:id/stats')
  @ApiOperation({ summary: 'POST reportStat' })
  async reportStat(@Param('id') id: string, @Body() dto: ReportStatDto) {
    return ok(await this.live.reportStat({ ...dto, roomId: Number(id) }));
  }

  @Post('digital-humans')
  @ApiOperation({ summary: 'POST createDigitalHuman' })
  async createDigitalHuman(@Body() dto: CreateDigitalHumanDto) {
    return ok(await this.live.createDigitalHuman(dto));
  }

  @Post('danmu/ai-reply')
  @ApiOperation({ summary: 'POST danmuAiReply' })
  async danmuAiReply(@Body() dto: DanmuAiReplyDto) {
    return ok(await this.live.danmuAiReply(dto));
  }
}
