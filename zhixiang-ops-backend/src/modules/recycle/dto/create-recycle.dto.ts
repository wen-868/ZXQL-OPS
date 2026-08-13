import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import { RECYCLE_SCOPES } from '../recycle.types';

/**
 * 发起回收 DTO（规划 §4-J / POST /api/ops/recycle）。
 * scope=video 时 targetRef 为 I 发布任务 id；阶段1 同步执行回收（数据回流 D + 人性效能）。
 */
export class CreateRecycleDto {
  @IsString()
  @IsIn(RECYCLE_SCOPES)
  scope!: string;

  @IsString()
  targetRef!: string;

  @IsOptional()
  @IsObject()
  metrics?: Record<string, any>;

  @IsOptional()
  comments?: string[];
}
