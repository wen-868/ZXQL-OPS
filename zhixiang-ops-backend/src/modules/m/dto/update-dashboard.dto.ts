import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/** 更新仪表盘配置 DTO（规划 §4-M / PUT /api/ops/dashboards/:id） */
export class UpdateDashboardDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object)
  widgets?: Array<Record<string, unknown>>;
}
