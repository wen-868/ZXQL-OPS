import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * 沉淀洞察 DTO（规划 §4-D 知识库）。
 * driver/emotion 合法性在服务层校验（需匹配 7 人性 / 6 情绪，否则抛 HUMANITY_INVALID / EMOTION_INVALID）。
 */
export class CreateInsightDto {
  @IsString()
  category: string;

  @IsString()
  driver: string;

  @IsString()
  emotion: string;

  @IsString()
  @MaxLength(255)
  title: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
