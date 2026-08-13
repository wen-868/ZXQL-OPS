import { IsIn, IsOptional, IsString, IsArray } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsIn(['wecom', 'wechat'], { message: 'type 须为 wecom/wechat' })
  type?: 'wecom' | 'wechat';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  members?: string[];
}
