import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { WORKFLOW_NODE_TYPES, WORKFLOW_TRIGGERS } from '../workflow.types';

/** 工作流节点 DTO */
export class WorkflowNodeDto {
  @IsString()
  id!: string;

  @IsString()
  @IsIn(WORKFLOW_NODE_TYPES)
  type!: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, any>;
}

/** 工作流边 DTO */
export class WorkflowEdgeDto {
  @IsString()
  from!: string;

  @IsString()
  to!: string;

  @IsOptional()
  @IsObject()
  condition?: Record<string, any>;
}

/** 新建/保存编排 DTO（规划 §4-L / POST /api/ops/workflows） */
export class CreateWorkflowDto {
  @IsString()
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WorkflowNodeDto)
  nodes!: WorkflowNodeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowEdgeDto)
  edges?: WorkflowEdgeDto[];

  @IsString()
  @IsIn(WORKFLOW_TRIGGERS)
  trigger!: string;

  @IsOptional()
  @IsString()
  cronExpr?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
