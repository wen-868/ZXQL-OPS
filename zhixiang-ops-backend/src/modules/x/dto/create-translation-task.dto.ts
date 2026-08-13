import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches } from 'class-validator';
import { SUPPORTED_LANGS } from '../x.types';

export class CreateTranslationTaskDto {
  @Type(() => Number)
  @IsInt()
  videoId!: number;

  /** 源语言（默认 zh） */
  @IsOptional()
  @IsString()
  @Matches(/^[a-z]{2}$/, { message: '语言码须为 2 位小写字母' })
  sourceLang?: string;

  /** 目标语言（白名单） */
  @IsString()
  @IsIn(SUPPORTED_LANGS)
  targetLang!: string;

  /** 待译制源文案（缺省时取出海视频标题） */
  @IsOptional()
  @IsString()
  sourceText?: string;
}
