import { IsInt, IsOptional, IsString, Min, IsNumber } from 'class-validator';

export class ReportMetricDto {
  @IsInt()
  campaignId!: number;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @Min(0)
  impressions?: number;

  @IsOptional()
  @Min(0)
  clicks?: number;

  @IsOptional()
  @Min(0)
  conversions?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;

  @IsOptional()
  @IsNumber()
  roi?: number;
}
