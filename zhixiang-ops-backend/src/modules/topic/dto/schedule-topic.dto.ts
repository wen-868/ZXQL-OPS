import { Type } from 'class-transformer';
import { IsInt, IsISO8601, IsOptional, Min } from 'class-validator';

/**
 * 选题排期 DTO（规划 §4-E / POST /api/ops/topic/topics/:id/schedule）。
 * 绑定发布时间（必填）与可选账号（B.accounts，不存在 → SCHEDULE_ACCOUNT_NOT_FOUND）。
 */
export class ScheduleTopicDto {
  @IsISO8601()
  scheduledAt: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  accountId?: number;
}
