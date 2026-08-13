import { IsString, IsEnum, IsOptional, IsArray, MaxLength } from 'class-validator';
import { CollectTaskType, SourceLevel } from '../intel.types';

/** 发起采集任务 DTO（规划 §4-C） */
export class CreateCollectTaskDto {
  @IsEnum(CollectTaskType)
  type: CollectTaskType;

  @IsString()
  @MaxLength(256)
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
}
