import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ContentPlatform } from '../r.types';

export class GenerateContentDto {
  @IsOptional()
  @IsString({ message: 'humanDriver 须为字符串（D 字典 7 人性之一）' })
  humanDriver?: string;

  @IsOptional()
  @IsEnum(['douyin', 'wechat', 'xhs', 'kuaishou'], {
    message: 'platform 须为 douyin/wechat/xhs/kuaishou',
  })
  platform?: ContentPlatform;
}
