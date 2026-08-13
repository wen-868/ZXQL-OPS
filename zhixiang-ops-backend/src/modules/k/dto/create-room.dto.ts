import { IsIn, IsInt, IsOptional, IsString, IsArray, ArrayUnique } from 'class-validator';

export class CreateRoomDto {
  @IsIn(['real', 'digital'], { message: 'type 须为 real/digital' })
  type!: 'real' | 'digital';

  @IsString()
  platform!: string;

  @IsInt()
  accountId!: number;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  productIds?: number[];
}
