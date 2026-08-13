import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, ValidateNested } from 'class-validator';

/** 4 类主数据同步细粒度开关（P3 客户自决） */
export class SyncScopesDto {
  @IsOptional()
  @IsBoolean()
  products?: boolean;

  @IsOptional()
  @IsBoolean()
  customers?: boolean;

  @IsOptional()
  @IsBoolean()
  inventory?: boolean;

  @IsOptional()
  @IsBoolean()
  orders?: boolean;
}

export class UpdateSyncConfigDto {
  /** 同步总开关：开启需满足「同时使用两个系统」条件 */
  @IsBoolean()
  syncEnabled: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => SyncScopesDto)
  scopes?: SyncScopesDto;
}
