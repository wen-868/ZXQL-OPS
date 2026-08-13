import { IsIn, IsString } from 'class-validator';
import { KnowledgeCategory } from '../knowledge.entity';

/** 新增知识条目 */
export class CreateKnowledgeDto {
  @IsIn(['product', 'order', 'logistics', 'faq'])
  category!: KnowledgeCategory;

  @IsString()
  question!: string;

  @IsString()
  answer!: string;
}
