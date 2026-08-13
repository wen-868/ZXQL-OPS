import { IsArray, IsOptional, IsString } from 'class-validator';

/** 成片编辑（AI 自动剪辑/模板化）DTO（规划 §4-H / POST /api/ops/videos/:id/edit） */
export class EditVideoDto {
  @IsOptional()
  @IsArray()
  materialIds?: number[];

  @IsOptional()
  @IsString()
  ratio?: string;
}
