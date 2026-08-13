import { IsIn, IsInt, IsOptional, IsString, IsNumber, Min, IsObject } from 'class-validator';

export class CreateCampaignDto {
  @IsInt()
  accountId!: number;

  @IsString()
  name!: string;

  @IsIn(['standard', 'full_domain', 'crowd', 'bid'], {
    message: 'planType 须为 standard/full_domain/crowd/bid',
  })
  planType!: 'standard' | 'full_domain' | 'crowd' | 'bid';

  @IsOptional()
  @IsObject()
  audience?: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  @Min(0)
  budget?: number;
}
