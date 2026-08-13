import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreateAdAccountDto {
  @IsIn(['douyin', 'wechat', 'kuaishou'], { message: 'platform 须为 douyin/wechat/kuaishou' })
  platform!: 'douyin' | 'wechat' | 'kuaishou';

  @IsIn(['qianchuan', 'adq', 'xiaodian_tong'], { message: 'type 须为 qianchuan/adq/xiaodian_tong' })
  type!: 'qianchuan' | 'adq' | 'xiaodian_tong';

  @IsOptional()
  @IsString()
  authEnc?: string;

  @IsOptional()
  @IsIn(['active', 'expired', 'banned'], { message: 'status 须为 active/expired/banned' })
  status?: 'active' | 'expired' | 'banned';
}
