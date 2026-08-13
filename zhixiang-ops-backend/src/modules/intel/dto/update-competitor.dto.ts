import { IsOptional, IsString, IsBoolean, IsUrl, MaxLength } from 'class-validator';

/** 更新竞品 DTO（规划 §4-C） */
export class UpdateCompetitorDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  name?: string;

  @IsOptional()
  @IsUrl({}, { message: 'url 须为合法链接' })
  @MaxLength(512)
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  category?: string;

  @IsOptional()
  @IsBoolean()
  monitorEnabled?: boolean;
}
