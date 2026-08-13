import { IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { PLATFORMS } from '../account.types';

/** 创建账号分组 DTO（B-advanced 分组管理） */
export class CreateAccountGroupDto {
  @IsString()
  @MaxLength(64)
  name!: string;

  @IsOptional()
  @IsIn(PLATFORMS)
  platform?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
