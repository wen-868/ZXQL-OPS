import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../shared/pagination';

/**
 * 选题列表查询 DTO（规划 §4-E / GET /api/ops/topic/topics）。
 * 继承标准分页；driver/emotion/status 为可选过滤。
 */
export class TopicQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  driver?: string;

  @IsOptional()
  @IsString()
  emotion?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
