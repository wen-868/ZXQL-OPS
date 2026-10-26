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
import { LlmProviderFieldsDto } from './llm-fields.dto';

const TYPES: LlmProviderType[] = ['ollama', 'openai', 'azure', 'custom'];

/** 新增大模型提供方；共用可选字段见 LlmProviderFieldsDto。 */
export class CreateLlmProviderDto extends LlmProviderFieldsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsEnum(TYPES)
  type!: LlmProviderType;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean = true;
}

/** 更新大模型提供方（全字段可选；apiKey 传空字符串表示不修改）。共用字段见 LlmProviderFieldsDto。 */
export class UpdateLlmProviderDto extends LlmProviderFieldsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEnum(TYPES)
  type?: LlmProviderType;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
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
