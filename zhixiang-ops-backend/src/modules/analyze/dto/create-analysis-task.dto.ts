import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AnalysisSource } from '../analyze.types';

/**
 * 发起人性分析任务 DTO（规划 §4-D）。
 * 默认消费全部 is_clean 评论（commentLimit 上限 1000 条，避免单次过载）。
 */
export class CreateAnalysisTaskDto {
  @IsOptional()
  @IsEnum(AnalysisSource)
  source?: AnalysisSource = AnalysisSource.Comments;

  @IsOptional()
  @IsString()
  platform?: string;

  /** 指定分析来源引用（评论 source_ref）；为空消费全部 is_clean 评论 */
  @IsOptional()
  inputRefs?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  commentLimit?: number = 200;
}
