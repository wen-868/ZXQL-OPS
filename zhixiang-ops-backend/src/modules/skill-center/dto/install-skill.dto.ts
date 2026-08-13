import { IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

/** 启用技能并(可选)绑定自有 Provider */
export class InstallSkillDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  providerId?: number;
}
