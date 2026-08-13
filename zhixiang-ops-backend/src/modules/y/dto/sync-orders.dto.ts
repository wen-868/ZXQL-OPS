import { IsArray, IsIn, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus } from '../order.entity';

export class SyncOrderItemDto {
  @IsString({ message: 'orderId 须为字符串' })
  orderId!: string;

  @IsString({ message: 'platform 须为字符串' })
  platform!: string;

  @IsOptional()
  @IsNumber({}, { message: 'productId 须为数字' })
  productId?: number;

  @IsOptional()
  @IsNumber({}, { message: 'quantity 须为数字' })
  quantity?: number;

  @IsNumber({}, { message: 'amount 须为数字' })
  amount!: number;

  @IsOptional()
  @IsNumber({}, { message: 'commission 须为数字' })
  commission?: number;

  @IsOptional()
  @IsIn(['pending_payment', 'paid', 'shipped', 'completed', 'refunded'], {
    message: 'status 取值非法',
  })
  status?: OrderStatus;

  @IsOptional()
  @IsString({ message: 'attributionId 须为字符串' })
  attributionId?: string;

  @IsOptional()
  buyer?: { name: string; phone: string; address: string; buyerRef?: string };
}

export class SyncOrdersDto {
  @IsOptional()
  @IsIn(['management', 'platform'], { message: 'source 取值非法' })
  source?: 'management' | 'platform';

  @IsArray({ message: 'orders 须为数组' })
  @ValidateNested({ each: true })
  @Type(() => SyncOrderItemDto)
  orders!: SyncOrderItemDto[];
}
