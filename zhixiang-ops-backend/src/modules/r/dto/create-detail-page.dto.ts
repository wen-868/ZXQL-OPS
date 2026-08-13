import { IsArray, IsOptional } from 'class-validator';

export class CreateDetailPageDto {
  @IsOptional()
  @IsArray({ message: 'sections 须为数组' })
  sections?: Record<string, unknown>[];
}
