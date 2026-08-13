import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';

/** 实拍上传 DTO（规划 §4-G / POST /api/ops/materials/upload） */
export class UploadMaterialDto {
  @IsIn(['image', 'video', 'music', 'subtitle', 'sticker', 'avatar'])
  type!: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  ratio?: string;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  relatedScriptId?: number;
}
