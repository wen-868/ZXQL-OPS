import { IsOptional, IsString } from 'class-validator';

export class CreateWaybillDto {
  @IsOptional()
  @IsString({ message: 'carrier 须为字符串' })
  carrier?: string;
}
