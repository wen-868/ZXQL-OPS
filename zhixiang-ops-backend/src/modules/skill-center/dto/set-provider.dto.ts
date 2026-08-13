import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

/** 改绑技能使用的 Provider（系统默认或自建 BYO） */
export class SetProviderDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  providerId!: number;
}
