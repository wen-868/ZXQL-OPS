import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { GenerateContentDto } from './dto/generate-content.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { CreateDetailPageDto } from './dto/create-detail-page.dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

/**
 * 商品内容中心控制器（规划 R 商品内容中心）。
 * 阶段1 MVP 登录体系未就绪，与既有模块一致——鉴权守卫待登录体系就绪后统一加装。
 */
@ApiTags('products')
@Controller('ops/products')
export class ProductController {
  constructor(private readonly svc: ProductService) {}

  /** 商品接入（三源：system/manual/competitor/t_selection） */
  @Post()
  @ApiOperation({ summary: '商品接入（三源：system/manual/competitor/t_selection） */' })
  ingest(@Body() dto: CreateProductDto) {
    return this.svc.ingest(dto);
  }

  /** 商品库 */
  @Get()
  @ApiOperation({ summary: '商品库 */' })
  list(@Query('category') category?: string) {
    return this.svc.list(category);
  }

  /** AI 生成标题/卖点/详情/话术/种草 */
  @Post(':id/content/generate')
  @ApiOperation({ summary: 'AI 生成标题/卖点/详情/话术/种草 */' })
  generate(@Param('id') id: string, @Body() dto: GenerateContentDto) {
    return this.svc.generateContent(Number(id), dto);
  }

  /** 商品内容（最新版本） */
  @Get(':id/content')
  @ApiOperation({ summary: '商品内容（最新版本） */' })
  content(@Param('id') id: string) {
    return this.svc.getContent(Number(id));
  }

  /** 合规校验（P 内嵌兜底） */
  @Post(':id/content/check')
  @ApiOperation({ summary: '合规校验（P 内嵌兜底） */' })
  check(@Param('id') id: string) {
    return this.svc.checkCompliance(Number(id));
  }

  /** 生成详情页 */
  @Post(':id/detail-page')
  @ApiOperation({ summary: '生成详情页 */' })
  detailPage(@Param('id') id: string, @Body() dto: CreateDetailPageDto) {
    return this.svc.createDetailPage(Number(id), dto);
  }

  /** 库存扣减/回写（Y 联动） */
  @Patch(':id/stock')
  @ApiOperation({ summary: '库存扣减/回写（Y 联动） */' })
  stock(@Param('id') id: string, @Body() dto: UpdateStockDto) {
    return this.svc.updateStock(Number(id), dto);
  }
}
