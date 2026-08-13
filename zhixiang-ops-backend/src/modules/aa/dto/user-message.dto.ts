import { IsString, Length } from 'class-validator';

/** 用户消息（触发 AI 自动回复或转人工） */
export class UserMessageDto {
  @IsString()
  @Length(1, 2000)
  content!: string;
}
