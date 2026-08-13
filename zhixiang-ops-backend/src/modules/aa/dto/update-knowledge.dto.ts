import { IsIn, IsOptional, IsString } from 'class-validator';
import { KnowledgeCategory } from '../knowledge.entity';

/** 更新知识条目（部分字段） */
export class UpdateKnowledgeDto {
  @IsOptional()
  @IsIn(['product', 'order', 'logistics', 'faq'])
  category?: KnowledgeCategory;

  @IsOptional()
  @IsString()
  question?: string;

  @IsOptional()
  @IsString()
  answer?: string;
}
