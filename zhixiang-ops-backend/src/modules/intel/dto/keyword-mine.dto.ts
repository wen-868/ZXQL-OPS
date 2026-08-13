import { IsString, MaxLength } from 'class-validator';

/** 关键词挖掘 DTO（规划 §4-C /keywords/mine） */
export class KeywordMineDto {
  @IsString()
  @MaxLength(32)
  platform: string;

  @IsString()
  @MaxLength(256)
  target: string;
}
