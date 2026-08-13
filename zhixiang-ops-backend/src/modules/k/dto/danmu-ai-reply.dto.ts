import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';

export class DanmuAiReplyDto {
  @IsInt()
  roomId!: number;

  @IsString()
  question!: string;

  @IsOptional()
  @IsIn(['auto', 'pending'], { message: 'status 须为 auto/pending' })
  status?: 'auto' | 'pending';
}
