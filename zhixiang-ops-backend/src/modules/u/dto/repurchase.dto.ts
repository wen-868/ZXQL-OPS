import { IsString, IsArray, IsNumber, Min, IsOptional } from 'class-validator';

export class RepurchaseDto {
  @IsString()
  publicId!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  products?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;
}
