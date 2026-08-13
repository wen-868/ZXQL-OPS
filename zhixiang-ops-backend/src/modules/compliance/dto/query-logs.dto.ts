import { IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

/** 预检日志查询（GET /api/ops/compliance/logs） */
export class QueryLogsDto {
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  pageSize?: number;

  @IsOptional()
  @IsString()
  scene?: string;

  @IsOptional()
  @IsString()
  result?: string;
}
