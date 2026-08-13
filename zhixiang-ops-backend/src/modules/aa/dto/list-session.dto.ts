import { IsIn, IsOptional } from 'class-validator';
import { CsChannel, CsSessionStatus } from '../session.entity';

/** 会话列表过滤 */
export class ListSessionDto {
  @IsOptional()
  @IsIn(['live_comment', 'private_dm', 'short_video_comment', 'order_message'])
  channel?: CsChannel;

  @IsOptional()
  @IsIn(['open', 'transferred', 'closed'])
  status?: CsSessionStatus;
}
