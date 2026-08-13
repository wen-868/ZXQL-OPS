import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

/**
 * 脚本生成 DTO（规划 §4-F / POST /api/ops/script/generate）。
 * 消费 E 选题（topicId），由能力网关生成脚本草稿；templateId 为可选模板引用。
 */
export class GenerateScriptDto {
  /** 归属选题 id（必填） */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  topicId!: number;

  /** 选用模板 id（可选，对应 SCRIPT_TEMPLATES） */
  @IsOptional()
  @IsString()
  templateId?: string;
}
