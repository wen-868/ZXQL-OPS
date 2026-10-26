import { IsIn, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 违禁词字段基类：create/update 共用的可选字段集中于此（A6 去重）。
 * word 因必填性不同，留在各自 DTO。
 */
export class ComplianceWordFieldsDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  level?: 'low' | 'medium' | 'high';

  @IsOptional()
  @IsIn(['pass', 'warn', 'block'])
  action?: 'pass' | 'warn' | 'block';

  @IsOptional()
  @Type(() => Boolean)
  enabled?: boolean;
}

/** 新增违禁词（POST /api/ops/compliance/words） */
export class AddComplianceWordDto extends ComplianceWordFieldsDto {
  @IsString()
  word!: string;
}

/** 更新违禁词（PUT /api/ops/compliance/words/:id），字段可选 */
export class UpdateComplianceWordDto extends ComplianceWordFieldsDto {
  @IsOptional()
  @IsString()
  word?: string;
}
