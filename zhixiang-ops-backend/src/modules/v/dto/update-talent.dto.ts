import { Type } from 'class-transformer';
import { IsNumber, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { TALENT_STATUSES, TALENT_TYPES } from '../v.types';

export class UpdateTalentDto {
  @IsOptional()
  @IsString()
  name?: string;

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
