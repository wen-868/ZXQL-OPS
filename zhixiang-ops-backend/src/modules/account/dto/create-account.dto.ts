import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, Min } from 'class-validator';
import { ACCOUNT_IDENTITIES, ACCOUNT_STAGES, PLATFORMS } from '../account.types';

/**
 * 创建账号 DTO。Token 以明文入参，由服务层加密存储（明文不落库）。
 */
export class CreateAccountDto {
  @IsIn(PLATFORMS)
  platform!: string;

  @IsString()
  platformAccountId!: string;

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
