import { IsOptional, IsBoolean, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/** 采集评论查询 DTO（供 D 人性分析分页/筛选消费） */
export class CollectedCommentQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number = 20;

  /** true=仅干净数据；false=仅未过清洗；不传=全部 */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isClean?: boolean;

  @IsOptional()
  @IsString()
  platform?: string;
}
