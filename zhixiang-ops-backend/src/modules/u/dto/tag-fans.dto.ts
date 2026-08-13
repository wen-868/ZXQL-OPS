import { IsArray, IsInt, IsString } from 'class-validator';

export class TagFansDto {
  @IsInt()
  id!: number;

  @IsArray()
  @IsString({ each: true })
  tags!: string[];
}
