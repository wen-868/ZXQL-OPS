import { IsInt, IsOptional, IsString } from 'class-validator';

export class UpdateStockDto {
  /** 库存变更：正=回写/入库，负=扣减（Y 订单联动） */
  @IsInt({ message: 'delta 须为整数（正=回写/入库，负=扣减）' })
  delta!: number;

  @IsOptional()
  @IsString({ message: 'reason 须为字符串' })
  reason?: string;
}
