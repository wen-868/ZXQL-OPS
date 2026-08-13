import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaterialService } from './g.service';
import { MaterialController } from './g.controller';
import { MaterialEntity } from './material.entity';
import { FileStorageService } from '../../shared/file-storage.service';

/**
 * 素材中心模块（规划 §4-G / 开发顺序 G 素材中心 / 阶段3 增强）。
 * SkillGateway 由 SkillModule@Global 提供，无需 import。
 */
@Module({
  imports: [TypeOrmModule.forFeature([MaterialEntity])],
  controllers: [MaterialController],
  providers: [MaterialService, FileStorageService],
  exports: [MaterialService],
})
export class GModule {}
