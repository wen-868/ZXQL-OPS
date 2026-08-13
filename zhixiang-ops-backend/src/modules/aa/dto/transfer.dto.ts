import { IsIn, IsOptional, IsString } from 'class-validator';
import { TicketPriority } from '../ticket.entity';

/** 转人工（显式或由 AI 低置信度自动触发） */
export class TransferDto {
  @IsOptional()
  @IsString()
  issue?: string;

  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'urgent'])
  priority?: TicketPriority;
}
