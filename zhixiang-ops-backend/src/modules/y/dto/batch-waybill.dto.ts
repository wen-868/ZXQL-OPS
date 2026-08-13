import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class BatchWaybillDto {
  @IsArray({ message: 'orderIds 须为数组' })
  @IsNumber({}, { each: true, message: 'orderIds 元素须为数字' })
  orderIds!: number[];

  @IsOptional()
  @IsString({ message: 'carrier 须为字符串' })
  carrier?: string;
}
