import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../shared/pagination';

/**
 * 脚本列表查询 DTO（规划 §4-F / GET /api/ops/script/scripts）。
 * 继承标准分页；topicId/status 为可选过滤。
 */
export class ScriptQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  topicId?: number;

  @IsOptional()
  @IsString()
  status?: string;
}
