import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';
import { WORKFLOW_TRIGGERS } from '../workflow.types';
import { WorkflowNodeDto, WorkflowEdgeDto } from './create-workflow.dto';

/** 更新/启停编排 DTO（规划 §4-L / POST /api/ops/workflows/:id） */
export class UpdateWorkflowDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowNodeDto)
  nodes?: WorkflowNodeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowEdgeDto)
  edges?: WorkflowEdgeDto[];

  @IsOptional()
  @IsString()
  @IsIn(WORKFLOW_TRIGGERS)
  trigger?: string;

  @IsOptional()
  @IsString()
  cronExpr?: string;
}
