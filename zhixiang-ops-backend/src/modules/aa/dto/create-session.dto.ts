import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { CsChannel } from '../session.entity';

/** 创建客服会话（多渠道接入：直播评论 / 私域 DM / 短视频评论 / 订单留言） */
export class CreateSessionDto {
  @IsIn(['live_comment', 'private_dm', 'short_video_comment', 'order_message'])
  channel!: CsChannel;

  /** 买家匿名引用（明文传入，service 内加密落库；不采集姓名/电话/地址） */
  @IsString()
  buyerRef!: string;

  @IsOptional()
  @IsInt()
  relatedOrderId?: number;

  @IsOptional()
  @IsInt()
  relatedProductId?: number;
}
