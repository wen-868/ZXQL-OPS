import { IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

/** 违禁词库查询（GET /api/ops/compliance/words） */
export class QueryWordsDto {
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  pageSize?: number;

  @IsOptional()
  @IsString()
  level?: string;

  @IsOptional()
  @IsString()
  category?: string;
}
