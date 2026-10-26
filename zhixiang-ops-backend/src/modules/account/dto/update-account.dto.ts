import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, Min } from 'class-validator';
import { ACCOUNT_STATUSES, PLATFORMS } from '../account.types';
import { AccountFieldsDto } from './account-fields.dto';

/** 更新账号 DTO（全字段可选，局部更新）。共用可选字段见 AccountFieldsDto。 */
export class UpdateAccountDto extends AccountFieldsDto {
  @IsOptional()
  @IsIn(PLATFORMS)
  platform?: string;

  @IsOptional()
  @IsString()
  platformAccountId?: string;

  @IsOptional()
  @IsIn(ACCOUNT_STATUSES)
  status?: string;

  @IsOptional()
  @IsISO8601()
  lastActiveAt?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  groupId?: number | null;

  @IsOptional()
  @IsString()
  @Max(64)
  persona?: string;
}
