import { IsOptional, IsString } from 'class-validator';

export class CreateDigitalHumanDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsString()
  voice?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
