import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MaterialService } from './g.service';
import { GenerateMaterialDto, TagMaterialDto, UploadMaterialDto } from './dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

/**
 * 素材中心控制器（规划 §4-G / 开发顺序 G 素材中心 / 阶段3 增强）。
 * 路由前缀 ops（全局前缀 api → /api/ops/*）。SkillGateway 由 SkillModule@Global 注入。
 * 租户隔离由服务层强约束。
 */
@ApiTags('ops')
@Controller('ops')
export class MaterialController {
  constructor(private readonly materialService: MaterialService) {}

  /** POST /api/ops/materials/generate — AI 画面/视频生成 */
  @Post('materials/generate')
  @ApiOperation({ summary: 'AI 画面/视频生成 */' })
  generate(@Body() dto: GenerateMaterialDto) {
    return this.materialService.generateMaterial(dto);
  }

  /** POST /api/ops/materials/upload — 实拍上传（支持文件流 + URL 两种模式） */
  @Post('materials/upload')
  @ApiOperation({ summary: '实拍上传（支持文件流 + URL 两种模式） */' })
  @UseInterceptors(FileInterceptor('file'))
  upload(@Body() dto: UploadMaterialDto, @UploadedFile() file?: Express.Multer.File) {
    return this.materialService.uploadMaterial(dto, file);
  }

  /** GET /api/ops/materials — 素材库（标签/类型检索） */
  @Get('materials')
  @ApiOperation({ summary: '素材库（标签/类型检索） */' })
  list(@Query() filter: { tag?: string; type?: string }) {
    return this.materialService.listMaterials(filter);
  }

  /** POST /api/ops/materials/:id/tag — 追加标签 */
  @Post('materials/:id/tag')
  @ApiOperation({ summary: '追加标签 */' })
  tag(@Param('id') id: string, @Body() dto: TagMaterialDto) {
    return this.materialService.addTag(Number(id), dto.tags);
  }
}
