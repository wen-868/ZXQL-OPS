import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { SelectionService } from './selection.service';
import { ImportSelectionDto } from './dto/import-selection.dto';
import { CreateSelectionListDto } from './dto/create-selection-list.dto';
import { SelectionFilterDto } from './dto/selection-filter.dto';

/**
 * 选品中心控制器（规划 T 选品中心）。
 * 阶段1 MVP 登录体系未就绪，与既有模块一致——鉴权守卫待登录体系就绪后统一加装。
 */
@Controller('ops/selection')
export class SelectionController {
  constructor(private readonly svc: SelectionService) {}

  /** 导入选品 {source, platform?, ids?, products?} */
  @Post('import')
  import(@Body() dto: ImportSelectionDto) {
    return this.svc.importSelection(dto);
  }

  /** 选品库筛选（佣金%/口碑分/销量/类目/人性/关键词） */
  @Get()
  list(@Query() filter: SelectionFilterDto) {
    return this.svc.querySelection(filter);
  }

  /** 榜单（飙升/黑马预警） */
  @Get('hot')
  hot() {
    return this.svc.getHot();
  }

  /** 蓝海词 / 黑马预警 */
  @Get('blue-ocean')
  blueOcean() {
    return this.svc.getBlueOcean();
  }

  /** 新建选品清单 */
  @Post('lists')
  createList(@Body() dto: CreateSelectionListDto) {
    return this.svc.createList(dto);
  }

  /** 选品清单列表 */
  @Get('lists')
  lists() {
    return this.svc.getLists();
  }

  /** 选品清单详情（展开选品） */
  @Get('lists/:id')
  listDetail(@Param('id') id: string) {
    return this.svc.getList(Number(id));
  }

  /** 删除选品清单 */
  @Delete('lists/:id')
  removeList(@Param('id') id: string) {
    return this.svc.removeList(Number(id));
  }
}
