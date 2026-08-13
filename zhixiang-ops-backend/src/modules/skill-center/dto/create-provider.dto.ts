import { IsIn, IsOptional, IsString, IsUrl, MaxLength, IsArray } from 'class-validator';
import { SkillType } from '../../../skill/skill.types';

/** 创建技能 Provider（租户 BYO / 外部源，API Key 加密存储） */
export class CreateProviderDto {
  @IsString()
  @IsIn(['text-generate', 'image-generate', 'video-generate', 'voice-clone', 'digital-human'])
  type!: SkillType;

  @IsString()
  @MaxLength(64)
  name!: string;

  @IsOptional()
  @IsString()
  @IsIn(['tenant-byo', 'external'])
  source?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  apiKey?: string;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(255)
  baseUrl?: string;

  @IsOptional()
  @IsArray()
  models?: string[];
}
