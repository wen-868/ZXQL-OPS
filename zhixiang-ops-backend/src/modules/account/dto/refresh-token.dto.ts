import { IsISO8601, IsOptional, IsString } from 'class-validator';

/** 续期 / 重新授权 DTO：提交新的 access token（及可选 refresh token 与过期时间） */
export class RefreshTokenDto {
  @IsString()
  accessToken!: string;

  @IsOptional()
  @IsString()
  refreshToken?: string;

  @IsOptional()
  @IsISO8601()
  tokenExpireAt?: string;
}
