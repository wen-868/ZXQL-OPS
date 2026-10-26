import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { PublishService } from './publish.service';
import { CreatePublishDto } from './dto/create-publish.dto';
import { BatchPublishDto } from './dto/batch-publish.dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

/**
 * 发布与分发控制器（规划 §4-I）。
 * 路由前缀 ops/publish（全局前缀 api → /api/ops/publish）。
 * 租户隔离由服务层 TenantContext.requireTenantId() 强约束。
 */
@ApiTags('publish')
@Controller('ops/publish')
export class PublishController {
  constructor(private readonly publishService: PublishService) {}

  @Post()
  @ApiOperation({ summary: 'POST publish' })
  publish(@Body() dto: CreatePublishDto) {
    return this.publishService.publish(dto);
  }

  @Post('batch')
  @ApiOperation({ summary: 'POST batchPublish' })
  batchPublish(@Body() dto: BatchPublishDto) {
    return this.publishService.batchPublish(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'GET getPublish' })
  getPublish(@Param('id') id: string) {
    return this.publishService.getPublish(Number(id));
  }

  @Get(':id/funnel')
  @ApiOperation({ summary: 'GET getFunnel' })
  getFunnel(@Param('id') id: string) {
    return this.publishService.getFunnel(Number(id));
  }
}
