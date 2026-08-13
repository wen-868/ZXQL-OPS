import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator';

/**
 * 发起发布 DTO（规划 §4-I / POST /api/ops/publish）。
 * 一键分发：同一脚本向多个账号(accountIds)各建一条发布任务。
 */
export class CreatePublishDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  scriptId!: number;

  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  accountIds!: number[];

  /** 平台（可选；若提供须与账号 platform 一致） */
  @IsOptional()
  @IsString()
  platform?: string;

  /** 定时发布时间（ISO，可选） */
  @IsOptional()
  @IsString()
  scheduledAt?: string;

  /** 挂车商品 id（可选，→ integration Product 适配层） */
  @IsOptional()
  @IsString()
  cartProductId?: string;

  /** 成片视频 ID（可选；抖音真实发布时需要已合成的视频） */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  videoId?: number;
}
