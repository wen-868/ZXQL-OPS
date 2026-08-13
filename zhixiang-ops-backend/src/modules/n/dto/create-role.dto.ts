import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

/** 创建角色 DTO */
export class CreateRoleDto {
  @IsString()
  @MaxLength(64)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsArray()
  @IsString({ each: true })
  permissions!: string[];
}
