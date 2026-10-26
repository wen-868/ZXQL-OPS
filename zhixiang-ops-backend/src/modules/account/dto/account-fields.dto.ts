import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, Min } from 'class-validator';
import { ACCOUNT_IDENTITIES, ACCOUNT_STAGES } from '../account.types';

/**
 * 账号字段基类：create/update 共用的可选字段集中于此（A6 去重）。
 * platform/platformAccountId 因必填性不同、status/lastActiveAt/groupId/persona
 * 仅更新存在，留在各自 DTO。
 */
export class AccountFieldsDto {
  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsIn(ACCOUNT_IDENTITIES)
  identity?: string;

  @IsOptional()
  @IsString()
  track?: string;

  @IsOptional()
  @IsIn(ACCOUNT_STAGES)
  stage?: string;

  @IsOptional()
  @IsString()
  accessToken?: string;

  @IsOptional()
  @IsString()
  refreshToken?: string;

  @IsOptional()
  @IsISO8601()
  tokenExpireAt?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  fansCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  followCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  likeCount?: number;

  @IsOptional()
  @IsString()
  @Max(255)
  remark?: string;
}
