import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { PaginationQueryDto } from '../../shared/pagination';

/** 新增员工（运营系统操作员账号） */
export class CreateEmployeeDto {
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  username!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(64)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  realName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  role?: string = 'editor';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1)
  status?: number = 1;
}

/** 更新员工（全字段可选；password 传入表示重置密码） */
export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  realName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  role?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1)
  status?: number;

  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(64)
  password?: string;
}

/** 列表查询 */
export class EmployeeQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  keyword?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1)
  status?: number;
}

/** 绑定 RBAC 角色 */
export class AssignRoleDto {
  @Type(() => Number)
  @IsInt()
  roleId!: number;
}
