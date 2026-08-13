import { Type } from 'class-transformer';
import { IsNumber, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { BRAND_ORDER_STATUSES } from '../v.types';

export class CreateBrandOrderDto {
  @IsString()
  advertiser!: string;

  @Type(() => Number)
  @IsInt()
  talentId!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  productId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  accountId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  videoId?: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount!: number;

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
  @IsIn(BRAND_ORDER_STATUSES)
  status?:
    'pending' | 'negotiating' | 'signed' | 'delivering' | 'completed' | 'settled' | 'cancelled';

  @IsOptional()
  @IsString()
  contractNo?: string;

  @IsOptional()
  meta?: Record<string, unknown>;
}
