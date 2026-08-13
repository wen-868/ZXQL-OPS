import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, Min } from 'class-validator';
import { ACCOUNT_IDENTITIES, ACCOUNT_STAGES, ACCOUNT_STATUSES, PLATFORMS } from '../account.types';

/** 更新账号 DTO（全字段可选，局部更新） */
export class UpdateAccountDto {
  @IsOptional()
  @IsIn(PLATFORMS)
  platform?: string;

  @IsOptional()
  @IsString()
  platformAccountId?: string;

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
  @IsIn(ACCOUNT_STATUSES)
  status?: string;

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
  @IsISO8601()
  lastActiveAt?: string;

  @IsOptional()
  @IsString()
  @Max(255)
  remark?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  groupId?: number | null;

  @IsOptional()
  @IsString()
  @Max(64)
  persona?: string;
}
