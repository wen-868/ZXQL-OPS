import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CleaningOptionsDto } from './create-collect-task.dto';

/** 采集源配置 DTO（ops_collect_sources CRUD） */
export class CreateCollectSourceDto {
  @IsString()
  @MaxLength(128)
  name: string;

  @IsString()
  @MaxLength(32)
  platform: string;

  /** comment / hot / keyword / url */
  @IsString()
  @MaxLength(32)
  sourceType: string;

  /** 目标：URL（mode=web 直接抓取）或 关键词 */
  @IsString()
  @MaxLength(512)
  target: string;

  /** web=公开网页抓取（真实）/ local=本地样本 */
  @IsString()
  @MaxLength(16)
  mode: string;

  /** 每分钟限频上限（缺省走服务端默认 10 次/分钟） */
  @IsOptional()
  @IsInt()
  @Min(1)
  rateLimit?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => CleaningOptionsDto)
  @IsObject()
  cleaning?: CleaningOptionsDto;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class UpdateCollectSourceDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  platform?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  sourceType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  target?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  mode?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  rateLimit?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => CleaningOptionsDto)
  @IsObject()
  cleaning?: CleaningOptionsDto;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
