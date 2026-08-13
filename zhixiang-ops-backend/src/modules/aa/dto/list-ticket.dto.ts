import { IsIn, IsOptional } from 'class-validator';
import { TicketStatus, TicketPriority } from '../ticket.entity';

/** 工单列表过滤 */
export class ListTicketDto {
  @IsOptional()
  @IsIn(['open', 'pending', 'resolved', 'closed'])
  status?: TicketStatus;

  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'urgent'])
  priority?: TicketPriority;
}
