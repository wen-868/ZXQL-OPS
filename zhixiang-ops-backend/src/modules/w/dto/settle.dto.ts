import { IsArray, IsIn, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/** 分账参与方（机构-达人-投手） */
export class SettlementPartyDto {
  @IsIn(['org', 'talent', 'ad_operator'], { message: 'role 须为 org/talent/ad_operator' })
  role!: string;

  @IsString()
  name!: string;

  @IsNumber()
  amount!: number;
}

/** 分账（机构-达人-投手） */
export class SettleDto {
  @IsIn(['org_talent_advertiser'])
  type!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SettlementPartyDto)
  parties!: SettlementPartyDto[];

  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsIn(['pending', 'settled', 'invoiced'])
  status?: string;
}
