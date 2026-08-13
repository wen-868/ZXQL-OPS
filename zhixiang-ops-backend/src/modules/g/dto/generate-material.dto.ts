import { IsIn, IsOptional, IsString } from 'class-validator';

export const MATERIAL_TYPES = ['image', 'video', 'music', 'subtitle', 'sticker', 'avatar'] as const;

/** AI 画面/视频生成 DTO（规划 §4-G / POST /api/ops/materials/generate） */
export class GenerateMaterialDto {
  @IsIn(MATERIAL_TYPES)
  type!: string;

  @IsString()
  prompt!: string;

  /** AI 画面 Provider（即梦/可灵/本地）；默认 local（经 Skill Gateway 源透明） */
  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  ratio?: string;

  @IsOptional()
  relatedScriptId?: number;
}
