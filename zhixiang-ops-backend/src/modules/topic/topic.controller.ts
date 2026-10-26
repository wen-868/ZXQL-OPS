import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { TopicService } from './topic.service';
import { GenerateTopicsDto } from './dto/generate-topics.dto';
import { UpdateTopicDto } from './dto/update-topic.dto';
import { TopicQueryDto } from './dto/topic-query.dto';
import { AbVariantDto } from './dto/ab-variant.dto';
import { ScheduleTopicDto } from './dto/schedule-topic.dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

/**
 * 选题引擎控制器（规划 §4-E）。
 * 路由前缀 ops/topic（全局前缀 api → /api/ops/topic）。
 * 租户隔离由服务层 TenantContext.requireTenantId() 强约束。
 */
@ApiTags('topic')
@Controller('ops/topic')
export class TopicController {
  constructor(private readonly topicService: TopicService) {}

  @Post('generate')
  @ApiOperation({ summary: 'POST generateTopics' })
  generateTopics(@Body() dto: GenerateTopicsDto) {
    return this.topicService.generateTopics(dto);
  }

  @Get('topics')
  @ApiOperation({ summary: 'GET listTopics' })
  listTopics(@Query() query: TopicQueryDto) {
    return this.topicService.listTopics(query);
  }

  @Get('topics/:id')
  @ApiOperation({ summary: 'GET getTopic' })
  getTopic(@Param('id') id: string) {
    return this.topicService.getTopic(Number(id));
  }

  @Patch('topics/:id')
  @ApiOperation({ summary: 'PATCH updateTopic' })
  updateTopic(@Param('id') id: string, @Body() dto: UpdateTopicDto) {
    return this.topicService.updateTopic(Number(id), dto);
  }

  @Post('topics/:id/ab')
  @ApiOperation({ summary: 'POST createAbVariant' })
  createAbVariant(@Param('id') id: string, @Body() dto: AbVariantDto) {
    return this.topicService.createAbVariant(Number(id), dto);
  }

  @Post('topics/:id/schedule')
  @ApiOperation({ summary: 'POST scheduleTopic' })
  scheduleTopic(@Param('id') id: string, @Body() dto: ScheduleTopicDto) {
    return this.topicService.scheduleTopic(Number(id), dto);
  }
}
