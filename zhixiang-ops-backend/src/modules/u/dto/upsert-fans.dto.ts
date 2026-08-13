import { IsIn, IsOptional, IsString, IsArray, IsObject } from 'class-validator';

/** 粉丝画像仅接受平台/公开ID/聚合分布/分层标签，禁止个体隐私字段（合规 §11②） */
export class UpsertFansDto {
  @IsString()
  platform!: string;

  @IsString()
  publicId!: string;

  @IsOptional()
  @IsString()
  level?: string;

  @IsOptional()
  @IsObject()
  interactAgg?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsIn(['aggregate', 'authorized', 'public'], {
    message: 'source 须为 aggregate/authorized/public',
  })
  source?: 'aggregate' | 'authorized' | 'public';
}
