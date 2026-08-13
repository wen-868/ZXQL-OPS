import { IsOptional, IsString } from 'class-validator';

/**
 * 违禁词预检 DTO（规划 §4-F / POST /api/ops/script/scripts/:id/check）。
 * 传入 content 则对传入内容预检并回写，否则对脚本当前 content 预检回写。
 */
export class ComplianceCheckDto {
  @IsOptional()
  @IsString()
  content?: string;
}
