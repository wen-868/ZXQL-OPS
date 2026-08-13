import { IsArray, IsInt, IsOptional, IsString } from 'class-validator';

/** 脚本转分镜+成片 DTO（规划 §4-H / POST /api/ops/videos/from-script） */
export class FromScriptDto {
  @IsInt()
  scriptId!: number;

  @IsOptional()
  @IsArray()
  materialIds?: number[];

  @IsOptional()
  @IsString()
  ratio?: string;

  @IsOptional()
  @IsString()
  title?: string;
}
