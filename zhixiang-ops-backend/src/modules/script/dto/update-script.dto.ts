import { IsArray, IsOptional, IsString } from 'class-validator';

/**
 * 脚本更新 DTO（规划 §4-F / PUT /api/ops/script/scripts/:id）。
 * 双轨编辑：脚本视角（content）与口播视角（spokenTrack/subtitleTrack）；
 * status 流转在服务层校验；hookEmotion 合法性（∈ 6 情绪）在服务层校验。
 */
export class UpdateScriptDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  hook?: string;

  @IsOptional()
  @IsString()
  hookEmotion?: string;

  @IsOptional()
  @IsArray()
  spokenTrack?: Array<{ tsStart: number; tsEnd: number; text: string }>;

  @IsOptional()
  @IsArray()
  subtitleTrack?: Array<{ tsStart: number; tsEnd: number; text: string }>;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  templateId?: string;
}
