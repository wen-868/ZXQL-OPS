import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * 大模型提供方字段基类：create/update 共用的可选字段集中于此（A6 去重）。
 * name/type 因必填性不同、enabled 因默认值不同，留在各自 DTO。
 */
export class LlmProviderFieldsDto {
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
  @IsString()
  @MaxLength(255)
  remark?: string;
}
