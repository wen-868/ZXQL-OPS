import { IsArray, IsEnum, IsInt } from 'class-validator';
import { CollectControlAction, CommentReviewStatus } from '../intel.types';

/** 任务生命周期控制：pause / resume / cancel / retry */
export class CollectControlDto {
  @IsEnum(CollectControlAction)
  action: CollectControlAction;
}

/** 单条评论审核 */
export class CommentReviewDto {
  @IsEnum(CommentReviewStatus)
  status: CommentReviewStatus;
}

/** 批量评论审核 */
export class CommentBatchReviewDto {
  @IsArray()
  @IsInt({ each: true })
  ids: number[];

  @IsEnum(CommentReviewStatus)
  status: CommentReviewStatus;
}
