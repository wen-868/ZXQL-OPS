import { Type } from 'class-transformer';
import { IsNumber, IsIn, IsOptional, Max, Min } from 'class-validator';
import { BRAND_ORDER_STATUSES } from '../v.types';

export class SettleBrandOrderDto {
  /** 达人分成比例%（0~100），其余归机构 */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  talentShareRate!: number;

  /** 指定商单目标状态（默认 completed→settle 流转为 settled） */
  @IsOptional()
  @IsIn(BRAND_ORDER_STATUSES)
  toStatus?: 'completed' | 'settled';
}
