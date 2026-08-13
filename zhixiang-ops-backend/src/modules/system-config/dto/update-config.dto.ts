import { IsString, MaxLength } from 'class-validator';

/** 更新系统配置（PUT /api/ops/system-configs/:key）；value 传空字符串表示清除 */
export class UpdateConfigDto {
  @IsString()
  @MaxLength(2048)
  value!: string;
}
