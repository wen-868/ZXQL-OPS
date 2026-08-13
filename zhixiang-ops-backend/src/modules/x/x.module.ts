import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OverseasService } from './x.service';
import { OverseasController } from './x.controller';
import { OverseasPlatformEntity } from './overseas-platform.entity';
import { OverseasVideoEntity } from './overseas-video.entity';
import { TranslationTaskEntity } from './translation-task.entity';
import { VideoEntity } from '../h/video.entity';
import { NModule } from '../n/n.module';

/**
 * 内容出海模块（规划 §4-X / 开发顺序 X 内容出海 / 阶段3 增强）。
 * - 译制经 SkillGateway（@Global）调用能力网关；
 * - 复用 N 操作审计（NModule 导出 AuditService）；
 * - 弱关联 H 成片实体（同 DataSource，forFeature 注册仓库）。
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      OverseasPlatformEntity,
      OverseasVideoEntity,
      TranslationTaskEntity,
      VideoEntity,
    ]),
    NModule,
  ],
  controllers: [OverseasController],
  providers: [OverseasService],
  exports: [OverseasService],
})
export class XModule {}
