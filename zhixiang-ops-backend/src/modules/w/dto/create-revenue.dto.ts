import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

/** 录入收益记录（多收入：佣金/坑位费/服务费/打赏/补贴） */
export class CreateRevenueDto {
  @IsIn(['commission', 'slot_fee', 'service_fee', 'tip', 'subsidy'], {
    message: 'source 须为 commission/slot_fee/service_fee/tip/subsidy',
  })
  source!: string;

  @IsString()
  platform!: string;

  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsString()
  relatedOrderId?: string;

  @IsOptional()
  @IsNumber()
  commission?: number;

  @IsOptional()
  @IsIn(['pending', 'settled'])
  status?: string;
}
