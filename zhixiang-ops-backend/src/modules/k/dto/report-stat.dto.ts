import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ReportStatDto {
  @IsInt()
  roomId!: number;

  @IsOptional()
  @Min(0)
  onlineCount?: number;

  @IsOptional()
  @Min(0)
  gmv?: number;

  @IsOptional()
  @IsString()
  ts?: string;
}
