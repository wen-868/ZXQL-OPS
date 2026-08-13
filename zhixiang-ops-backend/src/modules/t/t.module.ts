import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SelectionProductEntity } from './selection-product.entity';
import { SelectionListEntity } from './selection-list.entity';
import { SelectionService } from './selection.service';
import { SelectionController } from './selection.controller';
import { IntegrationModule } from '../../integration/integration.module';
import { NModule } from '../n/n.module';

/**
 * T 选品中心模块（规划 T 选品中心）。
 * 注入 IntegrationModule（读 Product 适配 / 集成模式）+ NModule（AuditService 落审计）。
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([SelectionProductEntity, SelectionListEntity]),
    IntegrationModule,
    NModule,
  ],
  controllers: [SelectionController],
  providers: [SelectionService],
  exports: [SelectionService],
})
export class TModule {}
