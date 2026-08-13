import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../shared/pagination';
import type { LlmProviderType } from './llm-provider.entity';

const TYPES: LlmProviderType[] = ['ollama', 'openai', 'azure', 'custom'];

/** 新增大模型提供方 */
export class CreateLlmProviderDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsEnum(TYPES)
  type!: LlmProviderType;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  baseUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  apiKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  defaultModel?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean = true;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string;
}

/** 更新大模型提供方（全字段可选；apiKey 传空字符串表示不修改） */
export class UpdateLlmProviderDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEnum(TYPES)
  type?: LlmProviderType;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  baseUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  apiKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  defaultModel?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string;
}

/** 列表查询（分页 + 过滤） */
export class LlmProviderQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(TYPES)
  type?: LlmProviderType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  enabled?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  keyword?: string;
}
