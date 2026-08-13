import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

/** 新建选品清单 */
export class CreateSelectionListDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  items?: number[];
}
