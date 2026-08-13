import { IsArray, IsString, IsNumber, Min } from 'class-validator';

export class DistributeDto {
  @IsArray()
  @IsString({ each: true })
  publicIds!: string[];

  @IsString()
  planName!: string;

  @IsNumber()
  @Min(0)
  tierCommission!: number;
}
