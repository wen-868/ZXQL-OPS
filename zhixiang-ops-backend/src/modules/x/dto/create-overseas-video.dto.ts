import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches } from 'class-validator';
import { SUPPORTED_LANGS } from '../x.types';

export class CreateOverseasVideoDto {
  @Type(() => Number)
  @IsInt()
  sourceVideoId!: number;

  @Type(() => Number)
  @IsInt()
  platformId!: number;

  @IsOptional()
  @IsString()
  title?: string;

  /** 目标语言（白名单） */
  @IsString()
  @IsIn(SUPPORTED_LANGS)
  targetLang!: string;

  @IsOptional()
  @IsString()
  @Matches(/^draft|translating|published|failed$/, { message: '非法出海视频状态' })
  status?: 'draft' | 'translating' | 'published' | 'failed';

  @IsOptional()
  meta?: Record<string, unknown>;
}
