import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

/** 批量发布单项（规划 §4-I / POST /api/ops/publish/batch） */
export class BatchPublishItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  scriptId!: number;

  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  accountIds!: number[];

  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  cartProductId?: string;
}

/** 批量发布 DTO（多组脚本×账号一键分发） */
export class BatchPublishDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BatchPublishItemDto)
  tasks!: BatchPublishItemDto[];
}
