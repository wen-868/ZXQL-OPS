import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ShelfService } from './shelf.service';
import { ShelfRuleInput } from './shelf.service';
import { ProductPipelineService, PipelineOptions } from './product-pipeline.service';
import { ECOMMERCE_PLATFORM_META, ECOMMERCE_PLATFORMS } from './ecommerce.types';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

/**
 * 电商自动上下架控制器（平台规则适配 + 规则管理 + 执行与巡检 + 商品全自动流水线）。
 * 与现有模块一致：鉴权守卫待登录体系统一加装（demo-login 经 x-tenant-id 注入）。
 */
@ApiTags('ecommerce')
@Controller('ops/ecommerce')
export class EcommerceController {
  constructor(
    private readonly shelf: ShelfService,
    private readonly pipeline: ProductPipelineService,
  ) {}

  /** 平台规则差异元信息（前端展示各平台上/下架规则差异） */
  @Get('platforms')
  @ApiOperation({ summary: '平台规则差异元信息（前端展示各平台上/下架规则差异） */' })
  platforms() {
    return ECOMMERCE_PLATFORMS.map((p) => ECOMMERCE_PLATFORM_META[p]);
  }

  // ---- 规则管理 ----

  @Post('shelf-rules')
  @ApiOperation({ summary: 'POST createRule' })
  createRule(@Body() dto: ShelfRuleInput) {
    return this.shelf.createRule(dto);
  }

  @Get('shelf-rules')
  @ApiOperation({ summary: 'GET listRules' })
  listRules(
    @Query('platform') platform?: string,
    @Query('strategy') strategy?: string,
    @Query('status') status?: string,
  ) {
    return this.shelf.listRules({ platform, strategy, status });
  }

  @Patch('shelf-rules/:id')
  @ApiOperation({ summary: 'PATCH updateRule' })
  updateRule(@Param('id') id: string, @Body() dto: Partial<ShelfRuleInput>) {
    return this.shelf.updateRule(Number(id), dto);
  }

  @Delete('shelf-rules/:id')
  @ApiOperation({ summary: 'DELETE removeRule' })
  removeRule(@Param('id') id: string) {
    return this.shelf.removeRule(Number(id));
  }

  // ---- 执行 ----

  /** 手动触发一次巡检（body 可传 tenantId 限定租户；不传扫全部启用规则） */
  @Post('shelf/run')
  @ApiOperation({
    summary: '手动触发一次巡检（body 可传 tenantId 限定租户；不传扫全部启用规则） */',
  })
  run(@Body('tenantId') tenantId?: string) {
    return this.shelf.runShelfCycle(tenantId);
  }

  // ---- 查询 ----

  @Get('shelf-jobs')
  @ApiOperation({ summary: 'GET listJobs' })
  listJobs(
    @Query('platform') platform?: string,
    @Query('status') status?: string,
    @Query('productId') productId?: string,
  ) {
    return this.shelf.listJobs({ platform, status, productId });
  }

  @Get('products')
  @ApiOperation({ summary: 'GET listProducts' })
  listProducts(@Query('platform') platform?: string, @Query('shelfStatus') shelfStatus?: string) {
    return this.shelf.listProductPlatforms({ platform, shelfStatus });
  }

  // ---- 商品全自动流水线（图片→卖点→详情页→自动填商品→多平台发布） ----

  /** 一键全自动：传一张图片，全链路自动完成（识图卖点→卖点搜索→自动填商品→详情页→多平台发布） */
  @Post('pipeline')
  @ApiOperation({
    summary:
      '一键全自动：传一张图片，全链路自动完成（识图卖点→卖点搜索→自动填商品→详情页→多平台发布） */',
  })
  @UseInterceptors(FileInterceptor('file'))
  runPipeline(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() opts: PipelineOptions,
  ) {
    if (!file) {
      return this.pipeline.runPipeline(
        { filename: '商品图片', path: '', mimetype: 'image/jpeg', size: 0 },
        opts,
      );
    }
    return this.pipeline.runPipeline(
      {
        filename: file.originalname,
        path: file.path,
        mimetype: file.mimetype,
        size: file.size,
      },
      opts,
    );
  }

  /** 流水线历史 */
  @Get('pipeline-runs')
  @ApiOperation({ summary: '流水线历史 */' })
  listRuns() {
    return this.pipeline.listRuns();
  }

  /** 流水线详情（各环节结果） */
  @Get('pipeline-runs/:id')
  @ApiOperation({ summary: '流水线详情（各环节结果） */' })
  getRun(@Param('id') id: string) {
    return this.pipeline.getRun(Number(id));
  }
}
