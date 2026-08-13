import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CustomerSessionEntity,
  CustomerMessageEntity,
  SupportTicketEntity,
  KnowledgeEntity,
  CsSettingsEntity,
} from './index';
import { CustomerService } from './aa.service';
import { CustomerController } from './aa.controller';
import { YModule } from '../y/y.module';
import { RModule } from '../r/r.module';
import { NModule } from '../n/n.module';

/**
 * AA 智能客服中心模块（规划 AA）。
 * - YModule：注入 OrderService（读订单/物流，结构化查询回复）。
 * - RModule：注入 ProductService（读商品，结构化查询回复）。
 * - NModule：AuditService（操作审计）。
 * - SkillGateway 由 SkillModule（@Global）提供，直接注入（AI 自动回复 text-generate）。
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      CustomerSessionEntity,
      CustomerMessageEntity,
      SupportTicketEntity,
      KnowledgeEntity,
      CsSettingsEntity,
    ]),
    YModule,
    RModule,
    NModule,
  ],
  controllers: [CustomerController],
  providers: [CustomerService],
  exports: [CustomerService],
})
export class AAModule {}
