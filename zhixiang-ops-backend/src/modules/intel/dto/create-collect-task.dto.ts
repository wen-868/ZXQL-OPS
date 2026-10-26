import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsInt,
  Min,
  IsObject,
  ValidateNested,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CollectTaskType, CleaningOptions, SourceLevel } from '../intel.types';

/** 清洗开关（发起任务时可按任务覆盖源/默认值） */
export class CleaningOptionsDto implements CleaningOptions {
  @IsOptional()
  @IsBoolean()
  dedup?: boolean;

  @IsOptional()
  @IsBoolean()
  piiStrip?: boolean;

  @IsOptional()
  @IsBoolean()
  adFilter?: boolean;

  /** true 则采集结果进入人工审核（pending），D 只消费 approved */
  @IsOptional()
  @IsBoolean()
  reviewRequired?: boolean;
}

/** 发起采集任务 DTO（规划 §4-C；增强：支持按源发起 + 清洗开关覆盖） */
export class CreateCollectTaskDto {
  @IsEnum(CollectTaskType)
  type: CollectTaskType;

  @IsString()
  @MaxLength(512)
  target: string;

  @IsString()
  @MaxLength(32)
  platform: string;

  /** 采集来源级别：仅允许 L1 / L2（禁止 L3 个体隐私） */
  @IsEnum(['L1', 'L2'] as SourceLevel[])
  sourceLevel: SourceLevel;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scope?: string[];

  /** 可覆盖实际采集字段白名单（默认取合规白名单） */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fieldsCollected?: string[];

  /** 关联采集源：发起时继承源配置（target/platform/rateLimit/cleaning/config） */
  @IsOptional()
  @IsInt()
  @Min(1)
  sourceId?: number;

  /** 本任务清洗开关（覆盖源/默认值） */
  @IsOptional()
  @ValidateNested()
  @Type(() => CleaningOptionsDto)
  @IsObject()
  cleaning?: CleaningOptionsDto;
}
