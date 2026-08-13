import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../shared/pagination';

/**
 * 洞察知识库查询 DTO（规划 §4-D）。
 * 支持按 driver / emotion / category 过滤 + 标准分页。
 */
export class InsightQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  driver?: string;

  @IsOptional()
  @IsString()
  emotion?: string;

  @IsOptional()
  @IsString()
  category?: string;
}
