import { IsOptional, IsString } from 'class-validator';

export class CreateOverseasPlatformDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  baseLang?: string;

  @IsOptional()
  meta?: Record<string, unknown>;
}
