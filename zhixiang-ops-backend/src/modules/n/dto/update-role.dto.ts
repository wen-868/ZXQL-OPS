import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

/** 更新角色 DTO（全字段可选，局部更新） */
export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}
