import { IsInt, IsOptional, IsNumber, Min } from 'class-validator';

export class SmartBidDto {
  @IsInt()
  campaignId!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  targetRoi?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bidAdjust?: number;
}
