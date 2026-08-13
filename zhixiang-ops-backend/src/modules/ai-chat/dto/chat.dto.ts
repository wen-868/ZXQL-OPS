import { IsArray, IsOptional, IsString } from 'class-validator';

/**
 * AI 助手对话请求 DTO。
 * 前端通过浮动 AI 对话框发送对话历史 + 新消息。
 */
export class ChatDto {
  @IsString()
  message: string;

  /** 最近几轮的对话历史，格式：[{role, content}] */
  @IsArray()
  @IsOptional()
  history?: { role: 'user' | 'assistant'; content: string }[];
}
