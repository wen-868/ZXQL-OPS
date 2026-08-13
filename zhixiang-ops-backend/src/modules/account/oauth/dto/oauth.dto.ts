import { IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { PLATFORMS } from '../../account.types';

/** 发起 OAuth 授权（B-core） */
export class OAuthStartDto {
  @IsString()
  @IsIn(PLATFORMS, { message: 'platform 须为已支持平台' })
  platform!: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  redirectUri?: string;
}

/** 平台授权回调 query（state + code） */
export class OAuthCallbackQueryDto {
  @IsString()
  @Length(8, 64)
  state!: string;

  @IsString()
  @MaxLength(512)
  code!: string;
}
