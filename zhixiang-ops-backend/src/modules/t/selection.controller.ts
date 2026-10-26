import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { SelectionService } from './selection.service';
import { ImportSelectionDto } from './dto/import-selection.dto';
import { CreateSelectionListDto } from './dto/create-selection-list.dto';
import { SelectionFilterDto } from './dto/selection-filter.dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

/**
 * 选品中心控制器（规划 T 选品中心）。
 * 阶段1 MVP 登录体系未就绪，与既有模块一致——鉴权守卫待登录体系就绪后统一加装。
 */
@ApiTags('selection')
@Controller('ops/selection')
export class SelectionController {
  constructor(private readonly svc: SelectionService) {}

  /** 导入选品 {source, platform?, ids?, products?} */
  @Post('import')
  @ApiOperation({ summary: '导入选品 {source, platform?, ids?, products?} */' })
  import(@Body() dto: ImportSelectionDto) {
    return this.svc.importSelection(dto);
  }

  /** 选品库筛选（佣金%/口碑分/销量/类目/人性/关键词） */
  @Get()
  @ApiOperation({ summary: '选品库筛选（佣金%/口碑分/销量/类目/人性/关键词） */' })
  list(@Query() filter: SelectionFilterDto) {
    return this.svc.querySelection(filter);
  }

  /** 榜单（飙升/黑马预警） */
  @Get('hot')
  @ApiOperation({ summary: '榜单（飙升/黑马预警） */' })
  hot() {
    return this.svc.getHot();
  }

  /** 蓝海词 / 黑马预警 */
  @Get('blue-ocean')
  @ApiOperation({ summary: '蓝海词 / 黑马预警 */' })
  blueOcean() {
    return this.svc.getBlueOcean();
  }

  /** 新建选品清单 */
  @Post('lists')
  @ApiOperation({ summary: '新建选品清单 */' })
  createList(@Body() dto: CreateSelectionListDto) {
    return this.svc.createList(dto);
  }

  /** 选品清单列表 */
  @Get('lists')
  @ApiOperation({ summary: '选品清单列表 */' })
  lists() {
    return this.svc.getLists();
  }

  /** 选品清单详情（展开选品） */
  @Get('lists/:id')
  @ApiOperation({ summary: '选品清单详情（展开选品） */' })
  listDetail(@Param('id') id: string) {
    return this.svc.getList(Number(id));
  }

  /** 删除选品清单 */
  @Delete('lists/:id')
  @ApiOperation({ summary: '删除选品清单 */' })
  removeList(@Param('id') id: string) {
    return this.svc.removeList(Number(id));
  }
}
