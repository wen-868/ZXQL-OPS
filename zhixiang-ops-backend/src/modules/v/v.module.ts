import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantBaseRepository } from '../../tenant/tenant-base.repository';
import { TalentCommerceService } from './v.service';
import { TalentCommerceController } from './v.controller';
import { TalentEntity } from './talent.entity';
import { BrandOrderEntity } from './brand-order.entity';
import { ProductEntity } from '../r/product.entity';
import { VideoEntity } from '../h/video.entity';
import { WModule } from '../w/w.module';
import { NModule } from '../n/n.module';

/**
 * 达人/商单管理模块（规划 §4-V / 开发顺序 V 达人/商单管理 / 阶段3 增强）。
 * - 复用 W 分账引擎（WModule 导出 RevenueService）落地商单分账；
 * - 复用 N 操作审计（NModule 导出 AuditService）；
 * - 弱关联 R 商品 / H 成片实体（同 DataSource，forFeature 注册仓库）。
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      TalentEntity,
      BrandOrderEntity,
      ProductEntity,
      VideoEntity,
      TenantBaseRepository,
    ]),
    WModule,
    NModule,
  ],
  controllers: [TalentCommerceController],
  providers: [TalentCommerceService],
  exports: [TalentCommerceService],
})
export class VModule {}
