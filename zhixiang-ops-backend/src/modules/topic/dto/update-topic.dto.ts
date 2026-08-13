import { Type } from 'class-transformer';
import { IsArray, IsInt, IsISO8601, IsOptional, IsString, Length, Max, Min } from 'class-validator';

/**
 * 选题更新 DTO（规划 §4-E / PATCH /api/ops/topic/topics/:id）。
 * 部分更新；status 流转须经状态机校验（canTransition）。
 */
export class UpdateTopicDto {
  @IsOptional()
  @IsString()
  @Length(1, 255)
  title?: string;

  /** 人性标签（7 选 1），非法 → HUMANITY_INVALID */
  @IsOptional()
  @IsString()
  humanDriver?: string;

  /** 情绪标签（6 选 1），非法 → EMOTION_INVALID */
  @IsOptional()
  @IsString()
  emotion?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  formulaTags?: string[];

  /** 状态流转，非法流转 → INVALID_STATUS_TRANSITION */
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  score?: number;

  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  accountId?: number;
}
