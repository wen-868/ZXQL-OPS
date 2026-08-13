import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * 选题生成 DTO（规划 §4-E / POST /api/ops/topic/generate）。
 * 从 D 洞察库（或指定分析任务）聚合生成选题；driver/emotion 为可选过滤条件，
 * 合法性在服务层校验（复用 HUMANITY_INVALID / EMOTION_INVALID）。
 */
export class GenerateTopicsDto {
  /** 按人性过滤（可选，7 选 1） */
  @IsOptional()
  @IsString()
  driver?: string;

  /** 按情绪过滤（可选，6 选 1） */
  @IsOptional()
  @IsString()
  emotion?: string;

  /** 消费洞察条数上限（默认 20，最大 50） */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  /** 指定分析任务 id（消费该任务 insights 而非知识库） */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  analysisId?: number;
}
