import { IsEnum, IsOptional, IsString, IsInt, IsNumber, Min } from 'class-validator';
import { ProductSourceType } from '../r.types';

export class CreateProductDto {
  @IsEnum(['system', 'manual', 'competitor', 't_selection'], {
    message: 'sourceType 须为 system/manual/competitor/t_selection',
  })
  sourceType!: ProductSourceType;

  @IsOptional()
  @IsString({ message: 'externalProductId 须为字符串' })
  externalProductId?: string;

  @IsOptional()
  @IsInt({ message: 'selectionProductId 须为整数' })
  selectionProductId?: number;

  @IsOptional()
  @IsString({ message: 'title 须为字符串' })
  title?: string;

  @IsOptional()
  @IsInt({ message: 'stock 须为整数' })
  @Min(0, { message: 'stock 不可为负' })
  stock?: number;

  @IsOptional()
  @IsNumber({}, { message: 'price 须为数字' })
  price?: number;

  @IsOptional()
  @IsString({ message: 'category 须为字符串' })
  category?: string;

  @IsOptional()
  @IsString({ message: 'humanDriver 须为字符串（D 字典 7 人性之一）' })
  humanDriver?: string;
}
