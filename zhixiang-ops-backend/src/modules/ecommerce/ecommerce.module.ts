import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShelfService } from './shelf.service';
import { ProductPipelineService } from './product-pipeline.service';
import { EcommerceController } from './shelf.controller';
import { ShelfRuleEntity } from './shelf-rule.entity';
import { ShelfJobEntity } from './shelf-job.entity';
import { ProductPlatformEntity } from './product-platform.entity';
import { ProductPipelineRunEntity } from './product-pipeline-run.entity';
import { ProductEntity } from '../r/product.entity';
import { RModule } from '../r/r.module';
import { IntelModule } from '../intel/intel.module';
import { ComplianceModule } from '../compliance/compliance.module';

/**
 * 电商自动上下架与商品全自动流水线模块。
 * - 依赖 RModule（商品主数据/内容/详情页）、IntelModule（卖点关键词挖掘）、ComplianceModule（合规预检）。
 * - 平台适配器为规则化模拟实现，真实 API 凭证就绪后替换适配器内部实现即可。
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ShelfRuleEntity,
      ShelfJobEntity,
      ProductPlatformEntity,
      ProductPipelineRunEntity,
      ProductEntity,
    ]),
    RModule,
    IntelModule,
    ComplianceModule,
  ],
  controllers: [EcommerceController],
  providers: [ShelfService, ProductPipelineService],
  exports: [ShelfService, ProductPipelineService],
})
export class EcommerceModule {}
