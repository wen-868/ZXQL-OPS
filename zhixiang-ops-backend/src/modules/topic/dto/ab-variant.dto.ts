import { Type } from 'class-transformer';
import { IsArray, IsInt, IsISO8601, IsOptional, IsString, Length, Min } from 'class-validator';

/**
 * A/B 变体创建 DTO（规划 §4-E / POST /api/ops/topic/topics/:id/ab）。
 * 基于基准选题派生变体；未传字段继承基准选题。不允许对 variant 再建 variant。
 */
export class AbVariantDto {
  @IsOptional()
  @IsString()
  @Length(1, 255)
  title?: string;

  @IsOptional()
  @IsString()
  humanDriver?: string;

  @IsOptional()
  @IsString()
  emotion?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  formulaTags?: string[];

  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  accountId?: number;
}
