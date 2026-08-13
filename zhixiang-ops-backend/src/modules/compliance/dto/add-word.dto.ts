import { IsString, IsOptional, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

/** 新增违禁词（POST /api/ops/compliance/words） */
export class AddComplianceWordDto {
  @IsString()
  word!: string;

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

/** 更新违禁词（PUT /api/ops/compliance/words/:id），字段可选 */
export class UpdateComplianceWordDto {
  @IsOptional()
  @IsString()
  word?: string;

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
