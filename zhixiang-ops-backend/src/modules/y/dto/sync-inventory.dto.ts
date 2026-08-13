import { IsInt, IsNumber, IsOptional, IsString } from 'class-validator';

export class SyncInventoryDto {
  @IsNumber({}, { message: 'productId 须为数字' })
  productId!: number;

  @IsInt({ message: 'delta 须为整数（正=回写/入库，负=扣减）' })
  delta!: number;

  @IsOptional()
  @IsString({ message: 'reason 须为字符串' })
  reason?: string;
}
