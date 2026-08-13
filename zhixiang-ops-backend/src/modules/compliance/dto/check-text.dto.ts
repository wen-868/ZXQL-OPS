import { IsString, IsOptional } from 'class-validator';

/** 合规预检请求（POST /api/ops/compliance/check） */
export class CheckTextDto {
  @IsString()
  text!: string;

  /** 预检场景：script / publish / live / aa / review（默认 script） */
  @IsOptional()
  @IsString()
  scene?: string;
}
