import { IsArray, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** 部署引导（首次部署，幂等）：创建默认角色 + 管理员 + 合规词库基线 */
export class InitDeployDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  tenantId?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  adminUsername?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(64)
  adminPassword?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  adminRealName?: string;
}

/** 运行期数据初始化（幂等，可重复执行，不删除现有数据） */
export class SeedDataDto {
  /** 指定域：roles / admin / compliance-words；缺省执行全部 */
  @IsOptional()
  @IsArray()
  @IsIn(['roles', 'admin', 'compliance-words'], { each: true })
  domains?: string[];
}
