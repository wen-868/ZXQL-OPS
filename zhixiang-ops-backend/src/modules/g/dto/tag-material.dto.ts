import { IsArray, IsString } from 'class-validator';

/** 标签 DTO（规划 §4-G / POST /api/ops/materials/:id/tag） */
export class TagMaterialDto {
  @IsArray()
  @IsString({ each: true })
  tags!: string[];
}
