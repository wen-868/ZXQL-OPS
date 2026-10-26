import { Type } from 'class-transformer';
import { IsNumber, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { TALENT_STATUSES, TALENT_TYPES } from '../v.types';

/**
 * 达人字段基类：create/update 共用的可选字段集中于此，
 * 避免两份 DTO 各自维护同构字段导致漂移（A6 去重）。
 */
export class TalentFieldsDto {
  @IsOptional()
  @IsIn(TALENT_TYPES)
  type?: 'internal' | 'external' | 'agency';

  @IsOptional()
  @IsString()
  contact?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  talentAccountId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  digitalHumanId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  agencyShareRate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  talentShareRate?: number;

  @IsOptional()
  @IsIn(TALENT_STATUSES)
  status?: 'active' | 'inactive' | 'cooperation_ended';

  @IsOptional()
  meta?: Record<string, unknown>;
}
