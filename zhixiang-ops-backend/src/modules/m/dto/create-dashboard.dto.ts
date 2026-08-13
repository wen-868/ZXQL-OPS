import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/** 创建仪表盘配置 DTO（规划 §4-M / POST /api/ops/dashboards） */
export class CreateDashboardDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object)
  widgets?: Array<Record<string, unknown>>;
}
