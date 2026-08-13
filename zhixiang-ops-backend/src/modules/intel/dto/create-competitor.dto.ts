import { IsString, IsOptional, IsUrl, MaxLength } from 'class-validator';
import { Platform } from '../../account/account.types';

/** 创建竞品 DTO（规划 §4-C） */
export class CreateCompetitorDto {
  @IsString()
  platform: Platform;

  @IsString()
  @MaxLength(128)
  name: string;

  @IsOptional()
  @IsUrl({}, { message: 'url 须为合法链接' })
  @MaxLength(512)
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  category?: string;
}
