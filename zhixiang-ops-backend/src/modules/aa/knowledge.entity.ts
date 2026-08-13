import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';

/** 知识库分类：product 商品 / order 订单 / logistics 物流 / faq 通用 */
export type KnowledgeCategory = 'product' | 'order' | 'logistics' | 'faq';
/** 知识来源：manual 手动 / sync_r 同步自商品 / sync_y 同步自订单物流 */
export type KnowledgeSource = 'manual' | 'sync_r' | 'sync_y';

/**
 * 知识库（ops_knowledge_base）。
 * AI 自动回复优先命中知识库（意图识别 + 知识检索），未命中再走能力网关生成。
 */
@Entity({ name: 'ops_knowledge_base' })
@Index('idx_cs_kb_tenant_category', ['tenantId', 'category'])
export class KnowledgeEntity extends BaseEntity {
  @Column({ name: 'category', type: 'varchar', length: 16, comment: '分类' })
  category!: KnowledgeCategory;

  @Column({ name: 'question', type: 'varchar', length: 512, comment: '问题/触发语' })
  question!: string;

  @Column({ name: 'answer', type: 'text', comment: '标准答案' })
  answer!: string;

  @Column({ name: 'source', type: 'varchar', length: 16, default: 'manual', comment: '来源' })
  source!: KnowledgeSource;
}
