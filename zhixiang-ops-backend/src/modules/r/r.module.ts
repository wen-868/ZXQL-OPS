import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { ProductEntity } from './product.entity';
import { ProductContentEntity } from './product-content.entity';
import { ProductDetailPageEntity } from './product-detail-page.entity';
import { IntegrationModule } from '../../integration/integration.module';
import { NModule } from '../n/n.module';
import { SelectionProductEntity } from '../t/selection-product.entity';

/**
 * R 商品内容中心模块（规划 R 商品内容中心）。
 * - 依赖 IntegrationModule（适配器接入商品主数据）、NModule（AuditService 审计）。
 * - SkillGateway 由 SkillModule（@Global）提供，直接注入。
 * - SelectionProductEntity 仅读（与 T 选品联动）。
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductEntity,
      ProductContentEntity,
      ProductDetailPageEntity,
      SelectionProductEntity,
    ]),
    IntegrationModule,
    NModule,
  ],
  controllers: [ProductController],
  providers: [ProductService],
  exports: [ProductService],
})
export class RModule {}
