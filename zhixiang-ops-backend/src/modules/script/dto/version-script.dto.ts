import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

/**
 * 脚本版本 DTO（规划 §4-F / POST /api/ops/script/scripts/:id/version）。
 * - action=save：以当前脚本为父版本，存一个新版本（version+1，status=draft）
 * - action=rollback：回滚到指定 sourceVersionId（须同选题同租户），覆盖当前脚本内容
 */
export class VersionScriptDto {
  @IsString()
  @IsIn(['save', 'rollback'])
  action!: 'save' | 'rollback';

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsArray()
  spokenTrack?: Array<{ tsStart: number; tsEnd: number; text: string }>;

  @IsOptional()
  @IsArray()
  subtitleTrack?: Array<{ tsStart: number; tsEnd: number; text: string }>;

  @IsOptional()
  @IsString()
  title?: string;

  /** rollback 时必须指定要回滚到的版本 id */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sourceVersionId?: number;
}
