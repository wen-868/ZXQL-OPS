import { IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString } from 'class-validator';
import { CsChannel } from '../session.entity';

/** 客服设置（每租户单条，upsert 语义） */
export class UpsertSettingsDto {
  @IsOptional()
  @IsArray()
  @IsIn(['live_comment', 'private_dm', 'short_video_comment', 'order_message'], { each: true })
  enabledChannels?: CsChannel[];

  @IsOptional()
  @IsNumber()
  transferThreshold?: number;

  @IsOptional()
  @IsBoolean()
  autoReplyEnabled?: boolean;

  @IsOptional()
  @IsString()
  greeting?: string;

  @IsOptional()
  @IsString()
  workingHours?: string;
}
