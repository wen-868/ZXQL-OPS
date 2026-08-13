import { IsOptional, IsString, Matches } from 'class-validator';
import { OVERSEAS_VIDEO_STATUSES } from '../x.types';

export class UpdateOverseasVideoDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  @Matches(/^draft|translating|published|failed$/, { message: '非法出海视频状态' })
  status?: 'draft' | 'translating' | 'published' | 'failed';

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  meta?: Record<string, unknown>;

  /** 校验用：声明合法状态集合（供 service 参照） */
  static readonly STATUSES = OVERSEAS_VIDEO_STATUSES;
}
