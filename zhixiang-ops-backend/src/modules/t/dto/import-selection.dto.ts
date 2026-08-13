import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';

/** 单条选品录入项（手动或平台快照） */
export class SelectionImportItem {
  @IsOptional()
  @IsString()
  externalProductId?: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  reputationScore?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sales30d?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  humanDriver?: string;

  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  metrics?: Record<string, unknown>;
}

/** 导入选品：优先用 products 本地录入（standalone 友好）；传 ids 则需 connected 模式经适配层拉取 */
export class ImportSelectionDto {
  @IsString()
  source!: string;

  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ids?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SelectionImportItem)
  products?: SelectionImportItem[];
}
