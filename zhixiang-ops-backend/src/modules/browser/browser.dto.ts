import { IsOptional, IsString } from 'class-validator';

/** 浏览器快照请求：可选目标路由与查询串（缺省 /home） */
export class SnapshotDto {
  /** 前端路由路径，如 /publish、/dashboard（必须 / 开头；缺省 /home） */
  @IsOptional()
  @IsString()
  path?: string;

  /** 追加查询串，如 days=30（不含前导 ?） */
  @IsOptional()
  @IsString()
  query?: string;
}
