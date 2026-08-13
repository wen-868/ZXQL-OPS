import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { TopicService } from './topic.service';
import { GenerateTopicsDto } from './dto/generate-topics.dto';
import { UpdateTopicDto } from './dto/update-topic.dto';
import { TopicQueryDto } from './dto/topic-query.dto';
import { AbVariantDto } from './dto/ab-variant.dto';
import { ScheduleTopicDto } from './dto/schedule-topic.dto';

/**
 * 选题引擎控制器（规划 §4-E）。
 * 路由前缀 ops/topic（全局前缀 api → /api/ops/topic）。
 * 租户隔离由服务层 TenantContext.requireTenantId() 强约束。
 */
@Controller('ops/topic')
export class TopicController {
  constructor(private readonly topicService: TopicService) {}

  @Post('generate')
  generateTopics(@Body() dto: GenerateTopicsDto) {
    return this.topicService.generateTopics(dto);
  }

  @Get('topics')
  listTopics(@Query() query: TopicQueryDto) {
    return this.topicService.listTopics(query);
  }

  @Get('topics/:id')
  getTopic(@Param('id') id: string) {
    return this.topicService.getTopic(Number(id));
  }

  @Patch('topics/:id')
  updateTopic(@Param('id') id: string, @Body() dto: UpdateTopicDto) {
    return this.topicService.updateTopic(Number(id), dto);
  }

  @Post('topics/:id/ab')
  createAbVariant(@Param('id') id: string, @Body() dto: AbVariantDto) {
    return this.topicService.createAbVariant(Number(id), dto);
  }

  @Post('topics/:id/schedule')
  scheduleTopic(@Param('id') id: string, @Body() dto: ScheduleTopicDto) {
    return this.topicService.scheduleTopic(Number(id), dto);
  }
}
