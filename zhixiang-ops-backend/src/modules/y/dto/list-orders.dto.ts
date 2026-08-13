import { IsIn, IsOptional, IsString } from 'class-validator';

export class ListOrdersQueryDto {
  @IsOptional()
  @IsIn(['pending_payment', 'paid', 'shipped', 'completed', 'refunded'], {
    message: 'status 取值非法',
  })
  status?: string;

  @IsOptional()
  @IsString({ message: 'platform 须为字符串' })
  platform?: string;
}
